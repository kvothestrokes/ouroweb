import sharp, { type Metadata } from 'sharp';
import { MAX_PHOTO_WIDTH } from '#lib/domain/design-variant.js';
import { uploadImage } from './imagekit.js';

export { MAX_PHOTO_WIDTH };

const MIN_PHOTO_WIDTH = 600;
const FORMATS = new Set(['jpeg', 'png', 'webp']);
const NOT_A_PHOTO = 'La foto debe ser JPG, PNG o WebP.';

export type PreparedPhoto = { ok: true; bytes: Buffer } | { ok: false; message: string };

/** Validates a real product photo and normalizes it to WebP no wider than MAX_PHOTO_WIDTH. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
	if (file.size === 0) return { ok: false, message: NOT_A_PHOTO };
	const input = Buffer.from(await file.arrayBuffer());

	let meta: Metadata;
	try {
		meta = await sharp(input).metadata();
	} catch {
		return { ok: false, message: NOT_A_PHOTO };
	}
	if (!meta.format || !FORMATS.has(meta.format) || !meta.width) {
		return { ok: false, message: NOT_A_PHOTO };
	}
	if (meta.width < MIN_PHOTO_WIDTH) {
		return {
			ok: false,
			message: `La foto es muy pequeña: súbela de al menos ${MIN_PHOTO_WIDTH} px de ancho.`
		};
	}

	const bytes = await sharp(input)
		.rotate() // honor the camera orientation before EXIF is dropped
		.resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
	return { ok: true, bytes };
}

/** Validates and uploads a product photo to the `products` folder; returns its path. */
export async function storeProductPhoto(
	file: File
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
	const prepared = await preparePhoto(file);
	if (!prepared.ok) return prepared;
	try {
		const path = await uploadImage(
			new File([new Uint8Array(prepared.bytes)], 'producto.webp', { type: 'image/webp' }),
			'products'
		);
		return { ok: true, path };
	} catch {
		return { ok: false, message: 'No pudimos subir la foto. Intenta de nuevo.' };
	}
}
