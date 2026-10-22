import { describe, expect, it } from 'vitest';
import {
	availableSizes,
	facetsFor,
	findCategory,
	productImages,
	toProductDetail,
	toStoreProduct
} from './store-product.js';
import { playera, row } from './test-fixtures.js';

describe('toStoreProduct', () => {
	it('inherits the garment type price and keeps colors, sizes and collections', () => {
		const product = toStoreProduct(row());
		expect(product.precio).toBe(17000);
		expect(product.colores).toEqual(['negro', 'rojo']);
		expect(product.colorOptions[1]).toEqual({
			key: 'rojo',
			nombre: 'Rojo',
			hex: '#cc0000',
			baseId: 'b-rojo'
		});
		expect(product.tallas).toEqual(['CH', 'M', 'G', 'XG', 'XXG']);
		expect(product.colecciones).toEqual(['naruto']);
		expect(product.fandom).toBe('Naruto');
		expect(product.enStock).toBe(false);
	});

	it('uses the product price when it has one, and null when nobody set a price', () => {
		expect(toStoreProduct(row({ precio_base: 25000 })).precio).toBe(25000);
		expect(toStoreProduct(row({ garment_types: null, product_colors: [] })).precio).toBeNull();
	});

	it('is in stock only in stock mode with at least one piece', () => {
		const stock = [{ garment_base_id: 'b-negro', talla: 'M', cantidad: 2 }];
		expect(toStoreProduct(row({ modo_stock: 'stock', product_stock: stock })).enStock).toBe(true);
		expect(
			toStoreProduct(row({ modo_stock: 'stock', product_stock: [{ ...stock[0], cantidad: 0 }] }))
				.enStock
		).toBe(false);
	});

	it('lists only sizes with stock for stock products', () => {
		const stock = [
			{ garment_base_id: 'b-negro', talla: 'M', cantidad: 2 },
			{ garment_base_id: 'b-rojo', talla: 'XG', cantidad: 1 },
			{ garment_base_id: 'b-rojo', talla: 'G', cantidad: 0 }
		];
		expect(toStoreProduct(row({ modo_stock: 'stock', product_stock: stock })).tallas).toEqual([
			'M',
			'XG'
		]);
	});
});

describe('productImages', () => {
	it('gives one mockup per color, versioned by the last update', () => {
		const images = productImages(toStoreProduct(row()));
		expect(images).toEqual([
			{ key: 'negro', src: '/img/p/akatsuki/negro', version: Date.parse('2026-10-02T00:00:00Z') },
			{ key: 'rojo', src: '/img/p/akatsuki/rojo', version: Date.parse('2026-10-02T00:00:00Z') }
		]);
	});

	it('gives real photos in their order', () => {
		const product = toStoreProduct(
			row({
				tipo_imagen: 'foto',
				product_colors: [],
				product_images: [
					{ id: 'f2', orden: 1 },
					{ id: 'f1', orden: 0 }
				]
			})
		);
		expect(productImages(product).map((image) => image.src)).toEqual(['/img/f/f1', '/img/f/f2']);
	});
});

describe('toProductDetail', () => {
	it('exposes surcharges, size guide and the bulk price', () => {
		const detail = toProductDetail(row());
		expect(detail.precioBase).toBe(17000);
		expect(detail.recargos).toEqual({ XG: 2000, XXG: 3000 });
		expect(detail.guiaTallas).toEqual({ M: { ancho_cm: 51, largo_cm: 71 } });
		expect(detail.mayoreo).toEqual({ precio: 15000, cantidadMin: 6 });
		expect(detail.permitePersonalizar).toBe(true);
	});

	it('hides the bulk price while its minimum quantity is undefined', () => {
		expect(
			toProductDetail(row({ garment_types: { ...playera, mayoreo_cantidad_min: null } })).mayoreo
		).toBeNull();
	});
});

describe('availableSizes', () => {
	it('allows every size for made-to-order products', () => {
		expect(availableSizes(toProductDetail(row()), 'negro')).toEqual(['CH', 'M', 'G', 'XG', 'XXG']);
	});

	it('allows only sizes with stock in the chosen color', () => {
		const detail = toProductDetail(
			row({
				modo_stock: 'stock',
				product_stock: [
					{ garment_base_id: 'b-negro', talla: 'M', cantidad: 2 },
					{ garment_base_id: 'b-rojo', talla: 'XG', cantidad: 1 }
				]
			})
		);
		expect(availableSizes(detail, 'negro')).toEqual(['M']);
		expect(availableSizes(detail, 'rojo')).toEqual(['XG']);
	});
});

describe('facetsFor', () => {
	it('collects colors by name, sizes in garment order and collections', () => {
		const facets = facetsFor([toStoreProduct(row()), toStoreProduct(row({ id: 'p2', slug: 'b' }))]);
		expect(facets.colores.map((color) => color.key)).toEqual(['negro', 'rojo']);
		expect(facets.tallas).toEqual(['CH', 'M', 'G', 'XG', 'XXG']);
		expect(facets.colecciones).toEqual(['naruto']);
	});
});

describe('findCategory', () => {
	const category = (id: string, slug: string, parent_id: string | null) => ({
		id,
		slug,
		nombre: slug,
		parent_id,
		es_estrella: false,
		orden: 0,
		activo: true
	});
	const tree = [
		{
			...category('r', 'ropa', null),
			children: [category('s1', 'playeras', 'r'), category('s2', 'sudaderas', 'r')]
		}
	];

	it('shows a root with all its subcategories', () => {
		expect(findCategory(tree, 'ropa')?.ids).toEqual(['r', 's1', 's2']);
	});

	it('shows only the subcategory, keeping its root for the submenu', () => {
		const found = findCategory(tree, 'sudaderas');
		expect(found?.ids).toEqual(['s2']);
		expect(found?.root.slug).toBe('ropa');
	});

	it('returns null for unknown or hidden categories', () => {
		expect(findCategory(tree, 'velas')).toBeNull();
	});
});
