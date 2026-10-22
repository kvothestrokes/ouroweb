import { describe, expect, it } from 'vitest';
import { applyFilters, parseFilters, type FilterableProduct } from './catalog-filters.js';

const products: FilterableProduct[] = [
	{
		slug: 'akatsuki',
		nombre: 'Playera Akatsuki',
		precio: 17000,
		colores: ['negro', 'rojo'],
		tallas: ['CH', 'M', 'G'],
		colecciones: ['naruto'],
		enStock: false,
		creado: '2026-10-01T00:00:00Z'
	},
	{
		slug: 'goku',
		nombre: 'Sudadera Goku',
		precio: 45000,
		colores: ['naranja'],
		tallas: ['M', 'XG'],
		colecciones: ['dragon-ball'],
		enStock: true,
		creado: '2026-10-20T00:00:00Z'
	},
	{
		slug: 'taza-pikachu',
		nombre: 'Taza Pikachu',
		precio: 18000,
		colores: [],
		tallas: [],
		colecciones: ['pokemon'],
		enStock: false,
		creado: '2026-10-10T00:00:00Z'
	},
	{
		slug: 'sin-precio',
		nombre: 'Playera sin precio',
		precio: null,
		colores: ['negro'],
		tallas: ['M'],
		colecciones: [],
		enStock: false,
		creado: '2026-09-01T00:00:00Z'
	}
];

const slugs = (list: FilterableProduct[]) => list.map((product) => product.slug);
const filters = (query: string) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
	it('reads every filter from the query string', () => {
		expect(
			filters(
				'q=goku&color=negro&color=rojo&talla=M&min=100&max=300&coleccion=naruto&stock=1&orden=precio-asc'
			)
		).toEqual({
			q: 'goku',
			colores: ['negro', 'rojo'],
			tallas: ['M'],
			min: 10000,
			max: 30000,
			coleccion: 'naruto',
			soloStock: true,
			orden: 'precio-asc'
		});
	});

	it('ignores invalid values and defaults to newest first', () => {
		expect(filters('min=abc&orden=raro&color=%3Cscript%3E')).toEqual({
			q: '',
			colores: [],
			tallas: [],
			min: null,
			max: null,
			coleccion: null,
			soloStock: false,
			orden: 'nuevos'
		});
	});
});

describe('applyFilters', () => {
	it('sorts newest first by default', () => {
		expect(slugs(applyFilters(products, filters('')))).toEqual([
			'goku',
			'taza-pikachu',
			'akatsuki',
			'sin-precio'
		]);
	});

	it('searches by name without accents or case', () => {
		expect(slugs(applyFilters(products, filters('q=PIKACHU')))).toEqual(['taza-pikachu']);
		expect(slugs(applyFilters(products, filters('q=sudádera')))).toEqual(['goku']);
	});

	it('filters by any of the chosen colors and sizes', () => {
		expect(slugs(applyFilters(products, filters('color=rojo&color=naranja')))).toEqual([
			'goku',
			'akatsuki'
		]);
		expect(slugs(applyFilters(products, filters('talla=XG')))).toEqual(['goku']);
	});

	it('filters by price range, leaving out products without a price', () => {
		expect(slugs(applyFilters(products, filters('min=170&max=180')))).toEqual([
			'taza-pikachu',
			'akatsuki'
		]);
	});

	it('filters by collection and stock', () => {
		expect(slugs(applyFilters(products, filters('coleccion=naruto')))).toEqual(['akatsuki']);
		expect(slugs(applyFilters(products, filters('stock=1')))).toEqual(['goku']);
	});

	it('sorts by price, products without a price last', () => {
		expect(slugs(applyFilters(products, filters('orden=precio-asc')))).toEqual([
			'akatsuki',
			'taza-pikachu',
			'goku',
			'sin-precio'
		]);
		expect(slugs(applyFilters(products, filters('orden=precio-desc')))).toEqual([
			'goku',
			'taza-pikachu',
			'akatsuki',
			'sin-precio'
		]);
	});
});
