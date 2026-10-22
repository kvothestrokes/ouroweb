import { error } from '@sveltejs/kit';
import { applyFilters, parseFilters } from '#lib/domain/catalog-filters.js';
import { isSlug } from '#lib/domain/slug.js';
import { facetsFor, findCategory } from '#lib/domain/store-product.js';
import { loadCollections, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, url }) => {
	if (!isSlug(params.categoria)) error(404, 'No encontrado');
	const { categories } = await parent();
	const found = findCategory(categories, params.categoria);
	if (!found) error(404, 'No encontrado');

	const [products, collections] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections()])
	);
	const inCategory = products.filter((product) => found.ids.includes(product.categoryId));
	const filters = parseFilters(url.searchParams);

	// Root pages lead with their star subcategory (spec 4.2).
	const star = found.node === found.root ? found.root.children.find((c) => c.es_estrella) : null;
	const starProduct = star && inCategory.find((product) => product.categoryId === star.id);

	return {
		category: found.node,
		root: found.root,
		star: star ? { slug: star.slug, nombre: star.nombre, product: starProduct ?? null } : null,
		products: applyFilters(inCategory, filters),
		total: inCategory.length,
		facets: facetsFor(inCategory),
		filters,
		collections
	};
};
