import sharp, { type Metadata } from 'sharp';
import { MAX_DESIGN_WIDTH } from '#lib/domain/design-variant.js';

export { MAX_DESIGN_WIDTH };

const MIN_DESIGN_WIDTH = 400;

export type PreparedDesign =
	{ ok: true; png: Buffer; width: number; height: number } | { ok: false; message: string };

const NOT_PNG = 'El diseño debe ser un PNG con fondo transparente.';

/** Validates an uploaded design and normalizes it to a PNG no wider than MAX_DESIGN_WIDTH. */
export async function prepareDesign(file: File): Promise<PreparedDesign> {
	if (file.size === 0) return { ok: false, message: NOT_PNG };
	const input = Buffer.from(await file.arrayBuffer());

	let meta: Metadata;
	try {
		meta = await sharp(input).metadata();
	} catch {
		return { ok: false, message: NOT_PNG };
	}
	if (meta.format !== 'png' || !meta.width || !meta.height) return { ok: false, message: NOT_PNG };
	if (!meta.hasAlpha || !(await hasTransparentPixels(input))) {
		return { ok: false, message: 'El PNG no tiene fondo transparente.' };
	}
	if (meta.width < MIN_DESIGN_WIDTH) {
		return {
			ok: false,
			message: `El diseño es muy pequeño: súbelo de al menos ${MIN_DESIGN_WIDTH} px de ancho.`
		};
	}

	const png = await sharp(input)
		.resize({ width: MAX_DESIGN_WIDTH, withoutEnlargement: true })
		.png({ compressionLevel: 9 })
		.toBuffer();
	const { width = 0, height = 0 } = await sharp(png).metadata();
	return { ok: true, png, width, height };
}

/** An alpha channel can be fully opaque; a design needs at least some transparent pixels. */
async function hasTransparentPixels(input: Buffer): Promise<boolean> {
	const { channels } = await sharp(input).stats();
	const alpha = channels[3];
	return alpha !== undefined && alpha.min < 255;
}
