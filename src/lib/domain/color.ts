const HEX = /^#([0-9a-f]{6})$/i;
const NEUTRAL = '#ede7dd';
const DARK_NEUTRAL = '#e8e2d8';

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/**
 * Backdrop for a garment photo: the garment color mixed into warm paper, light enough
 * that the photo (white background, multiply blend) keeps its contrast in both themes.
 * Near-black and near-white garments get a warm neutral instead of a dull grey.
 */
export function stageTint(hex: string): string {
	const match = HEX.exec(hex);
	if (!match) return NEUTRAL;
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max < 60) return DARK_NEUTRAL;
	if (min > 225 || max - min < 24) return NEUTRAL;
	const paper = [250, 245, 238];
	const mix = (channel: number, i: number) => paper[i] * 0.88 + channel * 0.12;
	return `#${[r, g, b].map((c, i) => toHex(mix(c, i))).join('')}`;
}
