import sharp from 'sharp';

/** File names drop accents; these colors need them back. */
const ACCENTS: Record<string, string> = {
	marron: 'marrón',
	salmon: 'salmón',
	carbon: 'carbón',
	limon: 'limón'
};

/** `rosa-pastel` → `Rosa pastel`, `marron` → `Marrón`. */
export function colorLabel(slug: string): string {
	const words = slug.split('-').map((word) => ACCENTS[word] ?? word);
	const text = words.join(' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Share of the photo sampled around the chest center (the garment, not the background). */
const SAMPLE = { centerX: 0.5, centerY: 0.5, size: 0.1 };

/**
 * Average garment color of a base photo and whether it counts as a light garment
 * (relative luminance above 0.5), which decides the design version to print.
 */
export async function sampleColor(photo: Buffer): Promise<{ hex: string; isLight: boolean }> {
	const { width, height } = await sharp(photo).metadata();
	if (!width || !height) throw new Error('photo has no dimensions');

	const side = Math.max(1, Math.round(Math.min(width, height) * SAMPLE.size));
	const region = {
		left: Math.round(width * SAMPLE.centerX - side / 2),
		top: Math.round(height * SAMPLE.centerY - side / 2),
		width: side,
		height: side
	};
	// stats() measures its input image, ignoring earlier operations: extract to a buffer first.
	const chest = await sharp(photo).extract(region).removeAlpha().png().toBuffer();
	const { channels } = await sharp(chest).stats();
	const [r, g, b] = channels.map((channel) => Math.round(channel.mean));

	const hex = '#' + [r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('');
	return { hex, isLight: luminance(r, g, b) > 0.5 };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(r: number, g: number, b: number): number {
	const [lr, lg, lb] = [r, g, b].map((value) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}
