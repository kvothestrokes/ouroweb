import { error } from '@sveltejs/kit';
import sharp from 'sharp';
import { printAreaFromForm } from '#lib/domain/print-area.js';
import { loadBase, loadWatermarkSource, parseFotoKey } from '#lib/server/garment-assets.js';
import { composeMockup } from '#lib/server/mockup.js';
import { sampleDesign } from '#lib/server/sample-design.js';
import type { RequestHandler } from './$types';

// Admin only (guarded in hooks.server.ts): mockup with the sample design for an unsaved area.
export const GET: RequestHandler = async ({ params, url, locals, setHeaders }) => {
	const { data: base } = await locals.supabase
		.from('garment_bases')
		.select('foto')
		.eq('id', params.id)
		.maybeSingle();
	const key = base ? parseFotoKey(base.foto) : null;
	const photo = key ? await loadBase(key.tipo, key.color) : null;
	if (!photo) error(404, 'Prenda base no encontrada');

	const { width = 0, height = 0 } = await sharp(photo).metadata();
	const form = new FormData();
	for (const name of ['x', 'y', 'ancho']) form.set(name, url.searchParams.get(name) ?? '');
	const result = printAreaFromForm(form, { width, height });
	if (!result.ok) error(400, result.message);

	const webp = await composeMockup({
		base: photo,
		design: await sampleDesign(),
		area: result.area,
		watermark: await loadWatermarkSource(),
		maxSize: 800
	});
	setHeaders({ 'content-type': 'image/webp', 'cache-control': 'private, max-age=60' });
	return new Response(new Uint8Array(webp));
};
