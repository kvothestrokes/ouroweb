import { loadProductDetails, storeData } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

// The cart lives in the browser, so the page ships the (small) catalog to price it there.
export const load: PageServerLoad = async () => ({
	products: await storeData(() => loadProductDetails())
});
