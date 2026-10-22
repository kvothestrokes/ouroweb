import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { STORE_IMAGE_HEADERS, productPhoto, storeImageWidth } from '#lib/server/store-images.js';
import type { RequestHandler } from './$types';

// Public: /img/f/<product-image-id>?w=800
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'No encontrado');
	const webp = await productPhoto(params.id, storeImageWidth(url.searchParams.get('w')));
	setHeaders(STORE_IMAGE_HEADERS);
	return new Response(new Uint8Array(webp));
};
