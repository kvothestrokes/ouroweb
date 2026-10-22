import { describe, expect, it } from 'vitest';
import type { CheckoutItem } from './checkout.js';
import { buildOrderLines } from './order-lines.js';
import { toProductDetail } from './store-product.js';
import { row } from './test-fixtures.js';

const item = (overrides: Partial<CheckoutItem> = {}): CheckoutItem => ({
	slug: 'akatsuki',
	color: 'negro',
	talla: 'M',
	cantidad: 1,
	personalizacion: null,
	...overrides
});

const madeToOrder = toProductDetail(row());
const inStock = toProductDetail(
	row({
		slug: 'stock',
		modo_stock: 'stock',
		product_stock: [{ garment_base_id: 'b-negro', talla: 'M', cantidad: 2 }]
	})
);
const mug = toProductDetail(
	row({
		id: 'p3',
		slug: 'taza',
		nombre: 'Taza',
		garment_types: null,
		product_colors: [],
		precio_base: 18000
	})
);

describe('buildOrderLines', () => {
	it('prices each line from the catalog, with size surcharge and color name', () => {
		const result = buildOrderLines(
			[item({ talla: 'XXG', cantidad: 2, personalizacion: 'Ana' })],
			[madeToOrder]
		);
		expect(result).toEqual({
			ok: true,
			value: {
				items: [
					{
						product_id: 'p1',
						nombre_snapshot: 'Playera Akatsuki',
						color: 'Negro',
						talla: 'XXG',
						cantidad: 2,
						precio_unitario: 17000,
						recargo_talla: 3000,
						personalizacion_texto: 'Ana'
					}
				],
				subtotal: 40000,
				descMayoreo: 0
			}
		});
	});

	it('applies the bulk price when the garment type reaches its minimum', () => {
		const result = buildOrderLines([item({ cantidad: 6 })], [madeToOrder]);
		expect(result.ok && result.value.descMayoreo).toBe(6 * 2000);
	});

	it('accepts products without colors or sizes', () => {
		const result = buildOrderLines([item({ slug: 'taza', color: null, talla: null })], [mug]);
		expect(result.ok && result.value.subtotal).toBe(18000);
	});

	it('rejects unknown products, colors and sizes', () => {
		expect(buildOrderLines([item({ slug: 'otro' })], [madeToOrder])).toEqual({
			ok: false,
			message:
				'Uno de los productos de tu carrito ya no está disponible. Quítalo e intenta de nuevo.'
		});
		expect(buildOrderLines([item({ color: 'verde' })], [madeToOrder]).ok).toBe(false);
		expect(buildOrderLines([item({ color: null })], [madeToOrder]).ok).toBe(false);
		expect(buildOrderLines([item({ talla: 'XS' })], [madeToOrder]).ok).toBe(false);
		expect(buildOrderLines([item({ slug: 'taza', color: 'negro', talla: null })], [mug]).ok).toBe(
			false
		);
	});

	it('rejects more pieces than in stock, adding up repeated lines', () => {
		expect(buildOrderLines([item({ slug: 'stock', cantidad: 2 })], [inStock]).ok).toBe(true);
		expect(
			buildOrderLines(
				[
					item({ slug: 'stock', cantidad: 2 }),
					item({ slug: 'stock', cantidad: 1, personalizacion: 'x' })
				],
				[inStock]
			)
		).toEqual({
			ok: false,
			message: 'Solo quedan 2 piezas de Playera Akatsuki (Negro, M). Ajusta la cantidad.'
		});
		expect(buildOrderLines([item({ slug: 'stock', color: 'rojo' })], [inStock]).ok).toBe(false);
	});

	it('rejects products without a price', () => {
		const noPrice = toProductDetail(
			row({ garment_types: null, product_colors: [], precio_base: null })
		);
		expect(buildOrderLines([item({ color: null, talla: null })], [noPrice]).ok).toBe(false);
	});
});
