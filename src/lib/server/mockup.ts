import sharp, { type OverlayOptions } from 'sharp';

/** Print area in pixels of the real base photo (spec section 10, `garment_bases.area_impresion`). */
export type PrintArea = { x: number; y: number; ancho: number };

export type MockupInput = {
	base: Buffer;
	/** Transparent PNG of the design; it never leaves the server on its own. */
	design: Buffer;
	area: PrintArea;
	/** Logo for the watermark; omitted only in tests and admin previews. */
	watermark?: Buffer;
	/** Longest side of the served image (spec section 5.3: bounded resolution). */
	maxSize?: number;
};

/** Watermark width as a share of the base width, and its opacity. */
const WATERMARK_SCALE = 0.1;
const WATERMARK_OPACITY = 0.18;

/**
 * Composes design + watermark over a base garment photo and returns a WebP no larger
 * than `maxSize`. Coordinates are in pixels of the original base photo.
 */
export async function composeMockup({
	base,
	design,
	area,
	watermark,
	maxSize = 1000
}: MockupInput): Promise<Buffer> {
	const { width, height } = await sharp(base).metadata();
	if (!width || !height) throw new Error('base image has no dimensions');

	const { x, y, ancho } = area;
	const valid =
		[x, y, ancho].every(Number.isInteger) &&
		x >= 0 &&
		y >= 0 &&
		ancho > 0 &&
		x + ancho <= width &&
		y < height;
	if (!valid) throw new Error(`print area ${JSON.stringify(area)} is outside the base`);

	// Scale the design to the print area width, then crop whatever overflows the base.
	const scaled = await sharp(design).resize({ width: ancho }).png().toBuffer();
	const scaledHeight = (await sharp(scaled).metadata()).height ?? 0;
	const visibleHeight = Math.min(scaledHeight, height - y);
	const designLayer =
		visibleHeight < scaledHeight
			? await sharp(scaled)
					.extract({ left: 0, top: 0, width: ancho, height: visibleHeight })
					.toBuffer()
			: scaled;

	const layers: OverlayOptions[] = [{ input: designLayer, left: x, top: y }];

	if (watermark) {
		const size = Math.max(1, Math.round(width * WATERMARK_SCALE));
		const margin = Math.round(size * 0.25);
		// On the garment, centered under the design: a corner mark over the photo background
		// is cropped away in a second.
		layers.push({
			input: await buildWatermark(watermark, size),
			left: clamp(x + Math.round((ancho - size) / 2), 0, width - size),
			top: clamp(y + visibleHeight + margin, 0, height - size)
		});
	}

	const composed = await sharp(base).composite(layers).png().toBuffer();
	return sharp(composed)
		.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer();
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Round, semi-transparent version of the logo. */
async function buildWatermark(source: Buffer, size: number): Promise<Buffer> {
	const r = size / 2;
	const mask = Buffer.from(
		`<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff" fill-opacity="${WATERMARK_OPACITY}"/></svg>`
	);
	return sharp(source)
		.resize(size, size, { fit: 'cover' })
		.ensureAlpha()
		.composite([{ input: mask, blend: 'dest-in' }])
		.png()
		.toBuffer();
}

/** Real product photo (mugs, candles…): resized WebP with the watermark in the bottom-right corner. */
export async function watermarkPhoto({
	photo,
	watermark,
	maxSize = 1000
}: {
	photo: Buffer;
	watermark: Buffer;
	maxSize?: number;
}): Promise<Buffer> {
	const rotated = await sharp(photo).rotate().toBuffer();
	const { width, height } = await sharp(rotated).metadata();
	if (!width || !height) throw new Error('photo has no dimensions');

	const size = Math.max(1, Math.round(width * WATERMARK_SCALE));
	const margin = Math.round(size * 0.25);
	const composed = await sharp(rotated)
		.composite([
			{
				input: await buildWatermark(watermark, size),
				left: width - size - margin,
				top: height - size - margin
			}
		])
		.png()
		.toBuffer();
	return sharp(composed)
		.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer();
}
