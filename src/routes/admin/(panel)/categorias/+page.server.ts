import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { categoryFromForm } from '#lib/domain/catalog.js';
import {
	listCategories,
	makeStar,
	saveCategory,
	setCategoryActive,
	toTree
} from '#lib/server/categories.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const rows = await listCategories(locals.supabase);
	if (!rows) error(500, 'No pudimos cargar las categorías.');
	return { tree: toTree(rows) };
};

const idField = z.uuid();

function readId(form: FormData): string | null {
	const parsed = idField.safeParse(form.get('id'));
	return parsed.success ? parsed.data : null;
}

export const actions = {
	crear: async ({ request, locals }) => {
		const form = await request.formData();
		const input = categoryFromForm(form);
		if (!input.ok) return fail(400, { message: input.message, nombre: form.get('nombre') });

		const problem = await saveCategory(locals.supabase, input.value, null);
		if (problem) return fail(400, { message: problem, nombre: input.value.nombre });
		return { success: `Categoría «${input.value.nombre}» creada.` };
	},

	activo: async ({ request, locals }) => {
		const form = await request.formData();
		const id = readId(form);
		if (!id) return fail(400, { message: 'Esa categoría no existe.' });
		const problem = await setCategoryActive(locals.supabase, id, form.get('activo') === 'true');
		if (problem) return fail(400, { message: problem });
		return { success: 'Estado actualizado.' };
	},

	estrella: async ({ request, locals }) => {
		const id = readId(await request.formData());
		if (!id) return fail(400, { message: 'Esa categoría no existe.' });
		const problem = await makeStar(locals.supabase, id);
		if (problem) return fail(400, { message: problem });
		return { success: 'Categoría estrella actualizada.' };
	}
} satisfies Actions;
