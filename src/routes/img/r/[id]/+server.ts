import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { SHORT_IMAGE_HEADERS, reviewPhoto } from '#lib/server/store-images.js';
import type { RequestHandler } from './$types';

// Public: /img/r/<review-id>?w=800&v=<version> — approved reviews only.
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'No encontrado');
	const webp = await reviewPhoto(params.id, url);
	setHeaders(SHORT_IMAGE_HEADERS);
	return new Response(new Uint8Array(webp));
};
