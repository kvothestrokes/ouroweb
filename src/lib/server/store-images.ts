import { error } from '@sveltejs/kit';
import { renderDesignMockup } from './designs.js';
import { parseFotoKey, loadWatermarkSource } from './garment-assets.js';
import { downloadImage } from './imagekit.js';
import { watermarkPhoto } from './mockup.js';
import { supabaseAdmin } from './supabase-admin.js';

/** Widths the store asks for (srcset); anything else is rejected so the CDN cache stays small. */
export const STORE_IMAGE_WIDTHS = [400, 800, 1000] as const;

export function storeImageWidth(value: string | null): number {
	const width = Number(value ?? 800);
	if (!STORE_IMAGE_WIDTHS.includes(width as (typeof STORE_IMAGE_WIDTHS)[number])) {
		error(400, 'Tamaño no permitido');
	}
	return width;
}

/**
 * Composed mockup of an active product in one of its colors. The design path is read with
 * the secret key and never leaves the server; only the composed, watermarked image does.
 */
export async function productMockup(slug: string, color: string, width: number): Promise<Buffer> {
	const { data: product } = await supabaseAdmin
		.from('products')
		.select(
			`tipo_imagen, activo,
			designs(path_prenda_oscura, path_prenda_clara),
			product_colors(garment_bases(foto, es_clara, area_impresion))`
		)
		.eq('slug', slug)
		.maybeSingle();
	if (!product?.activo || product.tipo_imagen !== 'mockup' || !product.designs) {
		error(404, 'No encontrado');
	}

	const base = product.product_colors
		.map((row) => row.garment_bases)
		.find((garment) => garment && parseFotoKey(garment.foto)?.color === color);
	if (!base) error(404, 'No encontrado');

	const webp = await renderDesignMockup(product.designs, base, { maxSize: width });
	if (!webp) error(404, 'No encontrado');
	return webp;
}

/** Real photo of an active product, resized and watermarked. */
export async function productPhoto(imageId: string, width: number): Promise<Buffer> {
	const { data: image } = await supabaseAdmin
		.from('product_images')
		.select('imagekit_path, products(activo)')
		.eq('id', imageId)
		.maybeSingle();
	if (!image?.products?.activo) error(404, 'No encontrado');

	return watermarkPhoto({
		photo: await downloadImage(image.imagekit_path),
		watermark: await loadWatermarkSource(),
		maxSize: width
	});
}

/** Long CDN cache: URLs carry a version (`v`) that changes whenever the image would. */
export const STORE_IMAGE_HEADERS = {
	'content-type': 'image/webp',
	'cache-control': 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400'
};
