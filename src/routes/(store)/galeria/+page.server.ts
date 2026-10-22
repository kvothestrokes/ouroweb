import { loadCollections, loadGallery, loadReviews, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [items, collections, reviews] = await storeData(() =>
		Promise.all([loadGallery(), loadCollections(), loadReviews()])
	);
	const used = new Set(items.map((item) => item.coleccion));
	return {
		items,
		collections: collections.filter((collection) => used.has(collection.slug)),
		reviews
	};
};
