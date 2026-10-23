import { applyFilters, parseFilters } from '#lib/domain/catalog-filters.js';
import { facetsFor } from '#lib/domain/store-product.js';
import { loadCollections, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [products, collections] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections()])
	);
	const filters = parseFilters(url.searchParams);
	return {
		products: applyFilters(products, filters),
		total: products.length,
		facets: facetsFor(products),
		filters,
		collections
	};
};
