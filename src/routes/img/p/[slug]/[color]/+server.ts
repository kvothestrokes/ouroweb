import { error } from '@sveltejs/kit';
import { isSlug } from '#lib/domain/slug.js';
import { STORE_IMAGE_HEADERS, productMockup } from '#lib/server/store-images.js';
import type { RequestHandler } from './$types';

// Public: /img/p/<product-slug>/<color>?w=800&v=<version>
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	if (!isSlug(params.slug) || !isSlug(params.color)) error(404, 'No encontrado');
	const webp = await productMockup(params.slug, params.color, url);
	setHeaders(STORE_IMAGE_HEADERS);
	return new Response(new Uint8Array(webp));
};
