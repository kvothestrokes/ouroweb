import { loadCollections, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [products, collections] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections()])
	);
	const featured = products.filter((product) => product.destacado);
	const withProducts = new Set(products.flatMap((product) => product.colecciones));
	return {
		featured: (featured.length ? featured : products).slice(0, 8),
		newest: products.filter((product) => !product.destacado).slice(0, 8),
		collections: collections.filter((collection) => withProducts.has(collection.slug)),
		total: products.length
	};
};
