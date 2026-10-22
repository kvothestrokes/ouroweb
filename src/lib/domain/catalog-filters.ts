import { isSlug } from './slug.js';

/** What the store filters on. Prices in cents; null means "no price yet". */
export type FilterableProduct = {
	slug: string;
	nombre: string;
	precio: number | null;
	/** Color keys (`negro`, `gris-jaspe`). */
	colores: string[];
	tallas: string[];
	/** Collection slugs. */
	colecciones: string[];
	enStock: boolean;
	/** ISO timestamp. */
	creado: string;
};

export const SORT_OPTIONS = [
	{ value: 'nuevos', label: 'Más nuevos' },
	{ value: 'precio-asc', label: 'Precio: menor a mayor' },
	{ value: 'precio-desc', label: 'Precio: mayor a menor' }
] as const;

export type SortOrder = (typeof SORT_OPTIONS)[number]['value'];

export type CatalogFilters = {
	q: string;
	colores: string[];
	tallas: string[];
	/** Cents. */
	min: number | null;
	max: number | null;
	coleccion: string | null;
	soloStock: boolean;
	orden: SortOrder;
};

const SIZE = /^[A-Z0-9]{1,5}$/;
const MAX_VALUES = 30;

/** Whole pesos from the query string to cents; anything else is ignored. */
function pesos(value: string | null): number | null {
	if (!value || !/^\d{1,6}$/.test(value)) return null;
	return Number(value) * 100;
}

/** Reads filters from the URL, dropping anything malformed (URLs are user input). */
export function parseFilters(params: URLSearchParams): CatalogFilters {
	const orden = params.get('orden');
	const coleccion = params.get('coleccion');
	return {
		q: (params.get('q') ?? '').trim().slice(0, 80),
		colores: params.getAll('color').filter(isSlug).slice(0, MAX_VALUES),
		tallas: params
			.getAll('talla')
			.filter((size) => SIZE.test(size))
			.slice(0, MAX_VALUES),
		min: pesos(params.get('min')),
		max: pesos(params.get('max')),
		coleccion: coleccion && isSlug(coleccion) ? coleccion : null,
		soloStock: params.get('stock') === '1',
		orden: SORT_OPTIONS.some((option) => option.value === orden) ? (orden as SortOrder) : 'nuevos'
	};
}

/** Lowercase without accents, for search. */
export function normalizeText(text: string): string {
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matches(product: FilterableProduct, filters: CatalogFilters): boolean {
	if (filters.q && !normalizeText(product.nombre).includes(normalizeText(filters.q))) return false;
	if (filters.colores.length && !filters.colores.some((color) => product.colores.includes(color))) {
		return false;
	}
	if (filters.tallas.length && !filters.tallas.some((size) => product.tallas.includes(size))) {
		return false;
	}
	if (filters.min !== null || filters.max !== null) {
		if (product.precio === null) return false;
		if (filters.min !== null && product.precio < filters.min) return false;
		if (filters.max !== null && product.precio > filters.max) return false;
	}
	if (filters.coleccion && !product.colecciones.includes(filters.coleccion)) return false;
	if (filters.soloStock && !product.enStock) return false;
	return true;
}

/** Price order with products without a price always last. */
function byPrice(direction: 1 | -1) {
	return (a: FilterableProduct, b: FilterableProduct) => {
		if (a.precio === null || b.precio === null) {
			return (a.precio === null ? 1 : 0) - (b.precio === null ? 1 : 0);
		}
		return (a.precio - b.precio) * direction;
	};
}

const newestFirst = (a: FilterableProduct, b: FilterableProduct) =>
	b.creado.localeCompare(a.creado);

export function applyFilters<T extends FilterableProduct>(
	products: T[],
	filters: CatalogFilters
): T[] {
	const sort =
		filters.orden === 'precio-asc'
			? byPrice(1)
			: filters.orden === 'precio-desc'
				? byPrice(-1)
				: newestFirst;
	return products.filter((product) => matches(product, filters)).sort(sort);
}

/** True when anything narrows the list (the sort order alone does not). */
export function hasActiveFilters(filters: CatalogFilters): boolean {
	return Boolean(
		filters.q ||
		filters.colores.length ||
		filters.tallas.length ||
		filters.min !== null ||
		filters.max !== null ||
		filters.coleccion ||
		filters.soloStock
	);
}
