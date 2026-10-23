import { describe, expect, it } from 'vitest';
import { activeOffer, basePrice, quoteLines, type QuoteLine } from './pricing.js';

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

describe('quoteLines', () => {
	const playera = (overrides: Partial<QuoteLine> = {}): QuoteLine => ({
		precioBase: 17000,
		recargo: 0,
		cantidad: 1,
		mayoreo: { grupo: 'playera', precio: 15000, cantidadMin: 6 },
		...overrides
	});

	it('adds size surcharges per piece', () => {
		const quote = quoteLines([playera({ cantidad: 2 }), playera({ recargo: 3000 })]);
		expect(quote.importes).toEqual([34000, 20000]);
		expect(quote.subtotal).toBe(54000);
		expect(quote.descMayoreo).toBe(0);
	});

	it('applies the bulk price once the group reaches the minimum, across lines', () => {
		const quote = quoteLines([playera({ cantidad: 4 }), playera({ cantidad: 2, recargo: 3000 })]);
		expect(quote.subtotal).toBe(4 * 17000 + 2 * 20000);
		expect(quote.descMayoreo).toBe(6 * 2000);
	});

	it('does not apply the bulk price one piece below the minimum or without a minimum', () => {
		expect(quoteLines([playera({ cantidad: 5 })]).descMayoreo).toBe(0);
		expect(quoteLines([playera({ cantidad: 10, mayoreo: null })]).descMayoreo).toBe(0);
	});
});

describe('activeOffer', () => {
	it('applies the offer until its end date (inclusive) or forever without one', () => {
		expect(activeOffer({ precio_oferta: 14000, oferta_hasta: '2026-10-31' }, '2026-10-31')).toBe(
			14000
		);
		expect(
			activeOffer({ precio_oferta: 14000, oferta_hasta: '2026-10-31' }, '2026-11-01')
		).toBeNull();
		expect(activeOffer({ precio_oferta: 14000, oferta_hasta: null }, '2030-01-01')).toBe(14000);
		expect(activeOffer({ precio_oferta: null, oferta_hasta: null }, '2026-10-22')).toBeNull();
	});
});
