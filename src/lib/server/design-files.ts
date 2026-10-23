import sharp, { type Metadata, type Sharp } from 'sharp';
import { MAX_DESIGN_WIDTH } from '#lib/domain/design-variant.js';

export { MAX_DESIGN_WIDTH };

const MIN_DESIGN_WIDTH = 400;

export type PreparedDesign =
	{ ok: true; png: Buffer; width: number; height: number } | { ok: false; message: string };

const NOT_PNG = 'El diseño debe ser un PNG con fondo transparente.';

/** Upload limits: bytes before reading and decoded pixels (guards against decompression bombs). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;

/** Validates an uploaded design and normalizes it to a PNG no wider than MAX_DESIGN_WIDTH. */
export async function prepareDesign(file: File): Promise<PreparedDesign> {
	if (file.size === 0) return { ok: false, message: NOT_PNG };
	if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: 'El archivo pesa más de 15 MB.' };
	const input = Buffer.from(await file.arrayBuffer());
	const open = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });

	let meta: Metadata;
	try {
		meta = await open().metadata();
	} catch {
		return { ok: false, message: NOT_PNG };
	}
	if (meta.format !== 'png' || !meta.width || !meta.height) return { ok: false, message: NOT_PNG };
	if (meta.width * meta.height > MAX_INPUT_PIXELS) {
		return { ok: false, message: 'El diseño es demasiado grande (máximo 40 megapíxeles).' };
	}
	if (!meta.hasAlpha || !(await hasTransparentPixels(open()))) {
		return { ok: false, message: 'El PNG no tiene fondo transparente.' };
	}
	if (meta.width < MIN_DESIGN_WIDTH) {
		return {
			ok: false,
			message: `El diseño es muy pequeño: súbelo de al menos ${MIN_DESIGN_WIDTH} px de ancho.`
		};
	}

	const png = await open()
		.resize({ width: MAX_DESIGN_WIDTH, withoutEnlargement: true })
		.png({ compressionLevel: 9 })
		.toBuffer();
	const { width = 0, height = 0 } = await sharp(png).metadata();
	return { ok: true, png, width, height };
}

/** An alpha channel can be fully opaque; a design needs at least some transparent pixels. */
async function hasTransparentPixels(image: Sharp): Promise<boolean> {
	const { channels } = await image.stats();
	const alpha = channels[3];
	return alpha !== undefined && alpha.min < 255;
}
