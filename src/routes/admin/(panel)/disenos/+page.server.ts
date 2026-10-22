import { error, fail, redirect } from '@sveltejs/kit';
import { listDesigns, pickedFile, storeDesignFile } from '#lib/server/designs.js';
import { deleteImageByPath } from '#lib/server/imagekit.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [designs, firstBase] = await Promise.all([
		listDesigns(locals.supabase),
		// Thumbnails use the first dark garment base (fallback: any base).
		locals.supabase
			.from('garment_bases')
			.select('id')
			.order('es_clara')
			.order('color_nombre')
			.limit(1)
			.maybeSingle()
	]);
	if (!designs) error(500, 'No pudimos cargar los diseños.');
	return { designs, thumbnailBaseId: firstBase.data?.id ?? null };
};

export const actions = {
	crear: async ({ request, locals }) => {
		const form = await request.formData();
		const nombre = String(form.get('nombre') ?? '').trim();
		if (!nombre || nombre.length > 80)
			return fail(400, { message: 'Escribe el nombre del diseño.' });

		const oscura = pickedFile(form.get('oscura'));
		const clara = pickedFile(form.get('clara'));
		if (!oscura && !clara) {
			return fail(400, { message: 'Sube al menos una versión del diseño (PNG transparente).' });
		}

		const uploaded: string[] = [];
		const paths: { path_prenda_oscura: string | null; path_prenda_clara: string | null } = {
			path_prenda_oscura: null,
			path_prenda_clara: null
		};
		for (const [column, file] of [
			['path_prenda_oscura', oscura],
			['path_prenda_clara', clara]
		] as const) {
			if (!file) continue;
			const stored = await storeDesignFile(file);
			if (!stored.ok) {
				await Promise.all(uploaded.map(deleteImageByPath));
				return fail(400, { message: stored.message });
			}
			uploaded.push(stored.path);
			paths[column] = stored.path;
		}

		const { data, error: insertError } = await locals.supabase
			.from('designs')
			.insert({ nombre, ...paths })
			.select('id')
			.single();
		if (insertError) {
			await Promise.all(uploaded.map(deleteImageByPath));
			return fail(500, { message: 'No pudimos guardar el diseño. Intenta de nuevo.' });
		}
		redirect(303, `/admin/disenos/${data.id}`);
	}
} satisfies Actions;
