import { describe, expect, it } from 'vitest';
import { designPathFor } from './design-variant.js';

const both = { path_prenda_oscura: '/d/oscura.png', path_prenda_clara: '/d/clara.png' };

describe('designPathFor', () => {
	it('uses the light-garment version on light garments and the dark one on dark garments', () => {
		expect(designPathFor(both, true)).toBe('/d/clara.png');
		expect(designPathFor(both, false)).toBe('/d/oscura.png');
	});

	it('falls back to the only version a design has', () => {
		expect(designPathFor({ path_prenda_oscura: '/d/o.png', path_prenda_clara: null }, true)).toBe(
			'/d/o.png'
		);
		expect(designPathFor({ path_prenda_oscura: null, path_prenda_clara: '/d/c.png' }, false)).toBe(
			'/d/c.png'
		);
	});

	it('returns null when the design has no file', () => {
		expect(designPathFor({ path_prenda_oscura: null, path_prenda_clara: null }, false)).toBeNull();
	});
});
