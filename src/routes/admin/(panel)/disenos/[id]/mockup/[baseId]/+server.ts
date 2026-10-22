import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { renderDesignMockup } from '#lib/server/designs.js';
import type { RequestHandler } from './$types';

const SIZES = new Set([400, 800]);

// Admin only (guarded in hooks.server.ts): preview of a design on one garment base.
export const GET: RequestHandler = async ({ params, url, locals, setHeaders }) => {
	if (!z.uuid().safeParse(params.id).success || !z.uuid().safeParse(params.baseId).success) {
		error(404, 'No encontrado');
	}
	const size = Number(url.searchParams.get('s') ?? 400);
	if (!SIZES.has(size)) error(400, 'Tamaño no permitido');

	const [design, base] = await Promise.all([
		locals.supabase
			.from('designs')
			.select('path_prenda_oscura, path_prenda_clara')
			.eq('id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('garment_bases')
			.select('foto, es_clara, area_impresion')
			.eq('id', params.baseId)
			.maybeSingle()
	]);
	if (!design.data || !base.data) error(404, 'No encontrado');

	const webp = await renderDesignMockup(design.data, base.data, { maxSize: size });
	if (!webp) error(404, 'Falta la foto o el archivo del diseño');

	setHeaders({ 'content-type': 'image/webp', 'cache-control': 'private, max-age=300' });
	return new Response(new Uint8Array(webp));
};
