import { STORE_PAGE_HEADERS, loadCategoryTree, storeData } from '#lib/server/store.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
	const categories = await storeData(loadCategoryTree);
	setHeaders(STORE_PAGE_HEADERS);
	return { categories };
};
