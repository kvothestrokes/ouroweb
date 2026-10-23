import {
	loadCategoryTree,
	loadCollections,
	loadStoreProducts,
	storeData
} from '#lib/server/store.js';
import type { RequestHandler } from './$types';

const escape = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Public pages only; the admin, cart, checkout and tracking stay out.
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const [categories, products, collections] = await storeData(() =>
		Promise.all([loadCategoryTree(), loadStoreProducts(), loadCollections()])
	);
	const paths = [
		'/',
		'/colecciones',
		'/galeria',
		'/encargos',
		...categories
			.flatMap((root) => [root, ...root.children])
			.map((category) => `/c/${category.slug}`),
		...collections.map((collection) => `/colecciones/${collection.slug}`),
		...products.map((product) => `/p/${product.slug}`)
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `\t<url><loc>${escape(url.origin + path)}</loc></url>`).join('\n')}
</urlset>`;
	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=3600'
	});
	return new Response(body);
};
