import { error } from '@sveltejs/kit';
import { isSlug } from '#lib/domain/slug.js';
import { findCategory } from '#lib/domain/store-product.js';
import { loadProductDetail, loadReviews, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	if (!isSlug(params.producto)) error(404, 'No encontrado');
	const [product, products] = await storeData(() =>
		Promise.all([loadProductDetail(params.producto), loadStoreProducts()])
	);
	const { categories } = await parent();
	// Hidden categories hide their products too.
	const category = categories
		.flatMap((root) => [root, ...root.children])
		.find((item) => item.id === product?.categoryId);
	if (!product || !category) error(404, 'No encontrado');

	const found = findCategory(categories, category.slug);
	const others = products.filter((item) => item.id !== product.id);
	const sameCollection = others.filter((item) =>
		item.colecciones.some((slug) => product.colecciones.includes(slug))
	);
	const sameCategory = others.filter(
		(item) => item.categoryId === product.categoryId && !sameCollection.includes(item)
	);

	const reviews = await storeData(() => loadReviews(product.id));

	return {
		reviews,
		product,
		category,
		root: found && found.root.id !== category.id ? found.root : null,
		related: [...sameCollection, ...sameCategory].slice(0, 4)
	};
};
