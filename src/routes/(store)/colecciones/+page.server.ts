import { loadCollections, loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [products, collections] = await storeData(() =>
		Promise.all([loadStoreProducts(), loadCollections()])
	);
	return {
		collections: collections.map((collection) => {
			const items = products.filter((product) => product.colecciones.includes(collection.slug));
			return { ...collection, count: items.length, cover: items[0] ?? null };
		})
	};
};
