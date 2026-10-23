import { describe, expect, it } from 'vitest';
import { stageTint } from './color.js';

describe('stageTint', () => {
	it('turns a garment color into a soft pastel backdrop', () => {
		expect(stageTint('#cc0000')).toBe('#f4d8d1');
		expect(stageTint('#1d4ed8')).toBe('#dfe1eb');
	});

	it('keeps very dark and very light garments on a warm neutral', () => {
		expect(stageTint('#111111')).toBe('#e8e2d8');
		expect(stageTint('#fafafa')).toBe('#ede7dd');
	});

	it('falls back to the neutral for invalid colors', () => {
		expect(stageTint('rojo')).toBe('#ede7dd');
	});
});
