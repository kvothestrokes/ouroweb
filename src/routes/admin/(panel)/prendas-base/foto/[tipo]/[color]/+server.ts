import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import { loadBase } from '#lib/server/garment-assets.js';
import type { RequestHandler } from './$types';

/** Sizes the panel asks for: grid thumbnails and the editor stage. */
const WIDTHS = new Set([400, 1000]);

// Admin only (guarded in hooks.server.ts): the plain base photo, without design or watermark.
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const photo = await loadBase(params.tipo, params.color);
	if (!photo) error(404, 'Foto no encontrada');

	const width = Number(url.searchParams.get('w') ?? 1000);
	if (!WIDTHS.has(width)) error(400, 'Tamaño no permitido');

	const webp = await sharp(photo).resize({ width }).webp({ quality: 80 }).toBuffer();
	setHeaders({ 'content-type': 'image/webp', 'cache-control': 'private, max-age=3600' });
	return new Response(new Uint8Array(webp));
};
