import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { categoryFromForm } from '#lib/domain/catalog.js';
import { deleteCategory, listCategories, saveCategory } from '#lib/server/categories.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'Categoría no encontrada');
	const rows = await listCategories(locals.supabase);
	if (!rows) error(500, 'No pudimos cargar la categoría.');

	const category = rows.find((row) => row.id === params.id);
	if (!category) error(404, 'Categoría no encontrada');

	const hasChildren = rows.some((row) => row.parent_id === category.id);
	return {
		category,
		hasChildren,
		// A category with subcategories stays a root, so it gets no parent options.
		roots: hasChildren
			? []
			: rows
					.filter((row) => !row.parent_id && row.id !== category.id)
					.map(({ id, nombre }) => ({ id, nombre }))
	};
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const input = categoryFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });

		const problem = await saveCategory(locals.supabase, input.value, params.id);
		if (problem) return fail(400, { message: problem });
		return { success: 'Cambios guardados.' };
	},

	eliminar: async ({ locals, params }) => {
		const problem = await deleteCategory(locals.supabase, params.id);
		if (problem) return fail(400, { message: problem });
		redirect(303, '/admin/categorias');
	}
} satisfies Actions;
