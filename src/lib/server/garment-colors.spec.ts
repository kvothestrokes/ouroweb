import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { colorLabel, sampleColor } from './garment-colors.js';

describe('colorLabel', () => {
	it('turns a file name into a readable color name', () => {
		expect(colorLabel('negro')).toBe('Negro');
		expect(colorLabel('rosa-pastel')).toBe('Rosa pastel');
		expect(colorLabel('gris-jaspe')).toBe('Gris jaspe');
	});

	it('restores the accents lost in file names', () => {
		expect(colorLabel('marron')).toBe('Marrón');
		expect(colorLabel('salmon')).toBe('Salmón');
		expect(colorLabel('carbon')).toBe('Carbón');
	});
});

describe('sampleColor', () => {
	function photo(background: string, chest: string): Promise<Buffer> {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${background}"/><rect x="120" y="120" width="160" height="160" fill="${chest}"/></svg>`;
		return sharp(Buffer.from(svg)).jpeg().toBuffer();
	}

	it('reads the garment color from the chest, not the photo background', async () => {
		const { hex, isLight } = await sampleColor(await photo('#ffffff', '#1a1a1a'));
		expect(hex).toMatch(/^#[0-9a-f]{6}$/);
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
		expect(Math.max(r, g, b)).toBeLessThan(45);
		expect(isLight).toBe(false);
	});

	it('flags light garments so designs use their light-garment version', async () => {
		expect((await sampleColor(await photo('#ffffff', '#f2ead3'))).isLight).toBe(true);
		expect((await sampleColor(await photo('#ffffff', '#c0392b'))).isLight).toBe(false);
	});
});
