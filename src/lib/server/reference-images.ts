import sharp from 'sharp';
import { MAX_INPUT_PIXELS } from './design-files.js';

/** The browser shrinks references before upload; this is only a safety cap. */
export const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const MAX_WIDTH = 1600;
const FORMATS = new Set(['jpeg', 'png', 'webp']);
const NOT_AN_IMAGE = 'Las imágenes de referencia deben ser JPG, PNG o WebP.';

export type PreparedReference = { ok: true; bytes: Buffer } | { ok: false; message: string };

/**
 * Validates a customer's reference image and re-encodes it to WebP: decoding and
 * encoding again drops metadata (location!) and anything that is not image data.
 */
export async function prepareReference(file: File): Promise<PreparedReference> {
	if (file.size === 0) return { ok: false, message: NOT_AN_IMAGE };
	if (file.size > MAX_REFERENCE_BYTES) {
		return { ok: false, message: 'Cada imagen de referencia debe pesar menos de 4 MB.' };
	}
	const input = Buffer.from(await file.arrayBuffer());
	try {
		const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
		const meta = await image.metadata();
		if (!meta.format || !FORMATS.has(meta.format)) return { ok: false, message: NOT_AN_IMAGE };
		const bytes = await image
			.rotate()
			.resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toBuffer();
		return { ok: true, bytes };
	} catch {
		return { ok: false, message: NOT_AN_IMAGE };
	}
}
