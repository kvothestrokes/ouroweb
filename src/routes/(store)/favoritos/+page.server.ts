import { loadStoreProducts, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

// Favorites live in the browser, so the page ships the (small) catalog and picks them there.
export const load: PageServerLoad = async () => ({
	products: await storeData(loadStoreProducts)
});
