import { describe, expect, it } from 'vitest';
import { baseColors, loadBase, loadWatermarkSource } from './garment-assets.js';

describe('baseColors', () => {
	it('lists the 19 playera colors from the file names', () => {
		const colors = baseColors('playera');
		expect(colors).toHaveLength(19);
		expect(colors).toContain('negro');
		expect(colors).toContain('rosa-pastel');
		expect(colors).toContain('gris-jaspe');
	});

	it('returns an empty list for an unknown garment type', () => {
		expect(baseColors('sudadera')).toEqual([]);
	});
});

describe('loadBase', () => {
	it('returns the JPEG bytes of a base photo', async () => {
		const bytes = await loadBase('playera', 'negro');
		expect(bytes).not.toBeNull();
		expect([...bytes!.subarray(0, 2)]).toEqual([0xff, 0xd8]);
	});

	it('returns null for unknown colors, types and path tricks', async () => {
		expect(await loadBase('playera', 'dorado')).toBeNull();
		expect(await loadBase('sudadera', 'negro')).toBeNull();
		expect(await loadBase('playera', '../../brand/watermark-source')).toBeNull();
		expect(await loadBase('../assets', 'negro')).toBeNull();
	});
});

describe('loadWatermarkSource', () => {
	it('returns the logo bytes', async () => {
		const bytes = await loadWatermarkSource();
		expect(bytes.length).toBeGreaterThan(1000);
	});
});
