import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { STORE_IMAGE_HEADERS, productPhoto } from '#lib/server/store-images.js';
import type { RequestHandler } from './$types';

// Public: /img/f/<product-image-id>?w=800&v=<version>
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'No encontrado');
	const webp = await productPhoto(params.id, url);
	setHeaders(STORE_IMAGE_HEADERS);
	return new Response(new Uint8Array(webp));
};
