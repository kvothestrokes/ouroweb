import { error, redirect } from '@sveltejs/kit';
import { renderDesignMockup } from './designs.js';
import { parseFotoKey, loadWatermarkSource } from './garment-assets.js';
import { downloadImage } from './imagekit.js';
import { watermarkPhoto } from './mockup.js';
import { isPublicProduct } from './store.js';
import { supabaseAdmin } from './supabase-admin.js';

/** Widths the store asks for (srcset); anything else is rejected so the CDN cache stays small. */
export const STORE_IMAGE_WIDTHS = [400, 800, 1000] as const;

/**
 * Only `w` (an allowed width) and `v` (the product version) are accepted, and `v` must be
 * the current one: otherwise `?v=1`, `?v=2`… would each miss the CDN cache and make the
 * server compose the image again. A stale or missing `v` redirects to the current URL.
 */
export function canonicalImageQuery(url: URL, version: number): number {
	const params = url.searchParams;
	if ([...params.keys()].some((key) => key !== 'w' && key !== 'v'))
		error(400, 'Parámetro no permitido');
	const width = Number(params.get('w') ?? 800);
	if (!STORE_IMAGE_WIDTHS.includes(width as (typeof STORE_IMAGE_WIDTHS)[number])) {
		error(400, 'Tamaño no permitido');
	}
	if (params.get('v') !== String(version) || params.getAll('w').length > 1) {
		redirect(308, `${url.pathname}?w=${width}&v=${version}`);
	}
	return width;
}

/**
 * Composed mockup of a public product in one of its colors. The design path is read with
 * the secret key and never leaves the server; only the composed, watermarked image does.
 */
export async function productMockup(slug: string, color: string, url: URL): Promise<Buffer> {
	const { data: product } = await supabaseAdmin
		.from('products')
		.select(
			`id, tipo_imagen, updated_at,
			designs(path_prenda_oscura, path_prenda_clara),
			product_colors(garment_bases(foto, es_clara, area_impresion))`
		)
		.eq('slug', slug)
		.maybeSingle();
	if (!product || product.tipo_imagen !== 'mockup' || !product.designs) error(404, 'No encontrado');

	const base = product.product_colors
		.map((row) => row.garment_bases)
		.find((garment) => garment && parseFotoKey(garment.foto)?.color === color);
	if (!base || !(await isPublicProduct(product.id))) error(404, 'No encontrado');

	const width = canonicalImageQuery(url, Date.parse(product.updated_at));
	const webp = await renderDesignMockup(product.designs, base, { maxSize: width });
	if (!webp) error(404, 'No encontrado');
	return webp;
}

/** Real photo of a public product, resized and watermarked. */
export async function productPhoto(imageId: string, url: URL): Promise<Buffer> {
	const { data: image } = await supabaseAdmin
		.from('product_images')
		.select('imagekit_path, products(id, updated_at)')
		.eq('id', imageId)
		.maybeSingle();
	if (!image?.products || !(await isPublicProduct(image.products.id))) error(404, 'No encontrado');

	const width = canonicalImageQuery(url, Date.parse(image.products.updated_at));
	return watermarkPhoto({
		photo: await downloadImage(image.imagekit_path),
		watermark: await loadWatermarkSource(),
		maxSize: width
	});
}

/**
 * CDN cache of a week: URLs carry the product version, so a saved product gets new URLs,
 * and an image of a product hidden later stops being served within days.
 */
export const STORE_IMAGE_HEADERS = {
	'content-type': 'image/webp',
	'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
};
