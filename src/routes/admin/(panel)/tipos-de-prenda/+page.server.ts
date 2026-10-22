import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Sizes a new garment type starts with (the business range, 2026-10-22). */
const DEFAULT_SIZES = ['CH', 'M', 'G', 'XG', 'XXG'];

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('garment_types')
		.select('id, nombre, tallas, precio_normal, precio_mayoreo, mayoreo_cantidad_min')
		.order('nombre');
	if (loadError) error(500, 'No pudimos cargar los tipos de prenda.');
	return { types: data };
};

export const actions = {
	crear: async ({ request, locals }) => {
		const nombre = String((await request.formData()).get('nombre') ?? '').trim();
		if (!nombre || nombre.length > 40)
			return fail(400, { message: 'Escribe el nombre de la prenda.' });

		const { data, error: insertError } = await locals.supabase
			.from('garment_types')
			.insert({ nombre, tallas: DEFAULT_SIZES })
			.select('id')
			.single();
		if (insertError) {
			const message =
				insertError.code === '23505'
					? 'Ya existe una prenda con ese nombre.'
					: 'No pudimos crearla. Intenta de nuevo.';
			return fail(400, { message });
		}
		redirect(303, `/admin/tipos-de-prenda/${data.id}`);
	}
} satisfies Actions;
