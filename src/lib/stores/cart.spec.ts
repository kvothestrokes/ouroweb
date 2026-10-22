import { describe, expect, it } from 'vitest';
import { addLine, parseCart, type CartLine } from './cart.svelte.js';

const line: CartLine = {
	slug: 'akatsuki',
	color: 'negro',
	talla: 'M',
	cantidad: 1,
	personalizacion: null
};

describe('addLine', () => {
	it('merges identical lines and caps the quantity', () => {
		expect(addLine([line], { ...line, cantidad: 2 })).toEqual([{ ...line, cantidad: 3 }]);
		expect(addLine([{ ...line, cantidad: 98 }], { ...line, cantidad: 5 })[0].cantidad).toBe(99);
	});

	it('keeps different sizes, colors or texts apart', () => {
		expect(addLine([line], { ...line, talla: 'G' })).toHaveLength(2);
		expect(addLine([line], { ...line, personalizacion: 'Mi nombre' })).toHaveLength(2);
	});
});

describe('parseCart', () => {
	it('drops malformed lines and broken data', () => {
		expect(
			parseCart(JSON.stringify([line, { ...line, cantidad: 0 }, { ...line, slug: '<x>' }, 'nope']))
		).toEqual([line]);
		expect(parseCart('{broken')).toEqual([]);
		expect(parseCart(null)).toEqual([]);
	});
});
