import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { collectionFromForm } from '#lib/domain/catalog.js';
import { deleteCollection, saveCollection } from '#lib/server/collections.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'Colección no encontrada');
	const { data: collection } = await locals.supabase
		.from('collections')
		.select('id, nombre, slug')
		.eq('id', params.id)
		.maybeSingle();
	if (!collection) error(404, 'Colección no encontrada');
	return { collection };
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const input = collectionFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });

		const problem = await saveCollection(locals.supabase, input.value, params.id);
		if (problem) return fail(400, { message: problem });
		return { success: 'Cambios guardados.' };
	},

	eliminar: async ({ locals, params }) => {
		const problem = await deleteCollection(locals.supabase, params.id);
		if (problem) return fail(400, { message: problem });
		redirect(303, '/admin/colecciones');
	}
} satisfies Actions;
