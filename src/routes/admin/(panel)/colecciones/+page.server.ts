import { error, fail } from '@sveltejs/kit';
import { collectionFromForm } from '#lib/domain/catalog.js';
import { listCollections, saveCollection } from '#lib/server/collections.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const collections = await listCollections(locals.supabase);
	if (!collections) error(500, 'No pudimos cargar las colecciones.');
	return { collections };
};

export const actions = {
	crear: async ({ request, locals }) => {
		const input = collectionFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });

		const problem = await saveCollection(locals.supabase, input.value, null);
		if (problem) return fail(400, { message: problem });
		return { success: `Colección «${input.value.nombre}» creada.` };
	}
} satisfies Actions;
