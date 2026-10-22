import { describe, expect, it } from 'vitest';
import { basePrice } from './pricing.js';

describe('basePrice', () => {
	it('uses the product price when it has one', () => {
		expect(basePrice({ precio_base: 25000 }, { precio_normal: 17000 })).toBe(25000);
		expect(basePrice({ precio_base: 18000 }, null)).toBe(18000);
	});

	it('falls back to the garment type price', () => {
		expect(basePrice({ precio_base: null }, { precio_normal: 17000 })).toBe(17000);
	});

	it('returns null when there is no price yet, never 0', () => {
		expect(basePrice({ precio_base: null }, { precio_normal: null })).toBeNull();
		expect(basePrice({ precio_base: null }, null)).toBeNull();
	});
});
