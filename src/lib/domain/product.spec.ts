import { describe, expect, it } from 'vitest';
import { productFromForm } from './product.js';

const CATEGORY = '11111111-1111-4111-8111-111111111111';
const PLAYERA = '22222222-2222-4222-8222-222222222222';
const DESIGN = '33333333-3333-4333-8333-333333333333';
const NEGRO = '44444444-4444-4444-8444-444444444444';
const BLANCO = '55555555-5555-4555-8555-555555555555';
const SUDADERA_NEGRA = '66666666-6666-4666-8666-666666666666';
const COLLECTION = '77777777-7777-4777-8777-777777777777';

const context = {
	garmentTypes: [{ id: PLAYERA, tallas: ['CH', 'M', 'G'] }],
	bases: [
		{ id: NEGRO, garment_type_id: PLAYERA },
		{ id: BLANCO, garment_type_id: PLAYERA },
		{ id: SUDADERA_NEGRA, garment_type_id: 'otra' }
	]
};

function form(values: Record<string, string | string[]>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(values)) {
		for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
	}
	return data;
}

const mockup = {
	nombre: 'Playera Akatsuki',
	slug: '',
	descripcion: 'Diseño de nubes rojas.',
	category_id: CATEGORY,
	tipo_imagen: 'mockup',
	garment_type_id: PLAYERA,
	design_id: DESIGN,
	precio: '',
	modo_stock: 'bajo_pedido',
	colores: [NEGRO, BLANCO],
	colecciones: [COLLECTION],
	activo: 'on'
};

describe('productFromForm', () => {
	it('reads a mockup garment product that inherits the garment price', () => {
		expect(productFromForm(form(mockup), context)).toEqual({
			ok: true,
			value: {
				product: {
					nombre: 'Playera Akatsuki',
					slug: 'playera-akatsuki',
					descripcion: 'Diseño de nubes rojas.',
					category_id: CATEGORY,
					tipo_imagen: 'mockup',
					garment_type_id: PLAYERA,
					design_id: DESIGN,
					precio_base: null,
					modo_stock: 'bajo_pedido',
					permite_personalizar: false,
					activo: true,
					destacado: false
				},
				colors: [NEGRO, BLANCO],
				collections: [COLLECTION],
				stock: []
			}
		});
	});

	it('reads stock per color and size, ignoring colors that are not selected', () => {
		const result = productFromForm(
			form({
				...mockup,
				modo_stock: 'stock',
				colores: [NEGRO],
				[`stock.${NEGRO}.M`]: '3',
				[`stock.${NEGRO}.G`]: '',
				[`stock.${BLANCO}.M`]: '9'
			}),
			context
		);
		expect(result.ok && result.value.stock).toEqual([
			{ garment_base_id: NEGRO, talla: 'CH', cantidad: 0 },
			{ garment_base_id: NEGRO, talla: 'M', cantidad: 3 },
			{ garment_base_id: NEGRO, talla: 'G', cantidad: 0 }
		]);
	});

	it('reads a photo product that is not a garment, with its own price', () => {
		const result = productFromForm(
			form({
				nombre: 'Taza mágica',
				slug: 'taza-magica',
				category_id: CATEGORY,
				tipo_imagen: 'foto',
				garment_type_id: '',
				design_id: DESIGN,
				precio: '180',
				modo_stock: 'bajo_pedido',
				colores: [NEGRO],
				permite_personalizar: 'on'
			}),
			context
		);
		expect(result.ok && result.value).toMatchObject({
			product: {
				tipo_imagen: 'foto',
				garment_type_id: null,
				design_id: null,
				precio_base: 18000,
				permite_personalizar: true
			},
			colors: []
		});
	});

	it('explains what a mockup needs', () => {
		const message = (values: Record<string, string | string[]>) => {
			const result = productFromForm(form({ ...mockup, ...values }), context);
			return result.ok ? null : result.message;
		};
		expect(message({ garment_type_id: '' })).toBe('Elige el tipo de prenda del mockup.');
		expect(message({ design_id: '' })).toBe('Elige el diseño del mockup.');
		expect(message({ colores: [] })).toBe('Elige al menos un color.');
		expect(message({ colores: [NEGRO, SUDADERA_NEGRA] })).toBe(
			'Hay colores que no son de esta prenda.'
		);
	});

	it('explains invalid basics, prices and stock', () => {
		const message = (values: Record<string, string | string[]>) => {
			const result = productFromForm(form({ ...mockup, ...values }), context);
			return result.ok ? null : result.message;
		};
		expect(message({ nombre: '' })).toBe('Escribe el nombre del producto.');
		expect(message({ category_id: '' })).toBe('Elige la categoría.');
		expect(message({ tipo_imagen: 'video' })).toBe('Elige cómo se muestra el producto.');
		expect(message({ precio: 'gratis' })).toBe('Revisa el precio.');
		expect(message({ tipo_imagen: 'foto', garment_type_id: '', precio: '' })).toBe(
			'Escribe el precio: este producto no es una prenda.'
		);
		expect(
			message({ tipo_imagen: 'foto', garment_type_id: '', precio: '90', modo_stock: 'stock' })
		).toBe('El inventario por color y talla solo aplica a prendas; usa «Bajo pedido».');
		expect(message({ modo_stock: 'stock', [`stock.${NEGRO}.M`]: '-1' })).toBe(
			'Revisa las cantidades del inventario.'
		);
	});
});
