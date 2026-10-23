import { error } from '@sveltejs/kit';
import { applyFilters, parseFilters } from '#lib/domain/catalog-filters.js';
import { isSlug } from '#lib/domain/slug.js';
import { facetsFor } from '#lib/domain/store-product.js';
import { loadCollections, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	if (!isSlug(params.slug)) error(404, 'No encontrado');
	const [products, collections] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections()])
	);
	const collection = collections.find((item) => item.slug === params.slug);
	if (!collection) error(404, 'No encontrado');

	const inCollection = products.filter((product) => product.colecciones.includes(collection.slug));
	const filters = { ...parseFilters(url.searchParams), coleccion: null };
	return {
		collection,
		products: applyFilters(inCollection, filters),
		total: inCollection.length,
		facets: facetsFor(inCollection),
		filters,
		collections
	};
};
