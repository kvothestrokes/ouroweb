import { error, fail, redirect } from '@sveltejs/kit';
import { productFromForm } from '#lib/domain/product.js';
import { loadProductContext, saveProduct } from '#lib/server/products.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const context = await loadProductContext(locals.supabase);
	if (!context) error(500, 'No pudimos cargar los datos del catálogo.');
	return { context };
};

export const actions = {
	default: async ({ request, locals }) => {
		const context = await loadProductContext(locals.supabase);
		if (!context) return fail(500, { message: 'No pudimos cargar los datos del catálogo.' });

		const input = productFromForm(await request.formData(), context);
		if (!input.ok) return fail(400, { message: input.message });

		const saved = await saveProduct(locals.supabase, input.value, null);
		if (!saved.ok) return fail(400, { message: saved.message });
		redirect(303, `/admin/productos/${saved.id}?creado=1`);
	}
} satisfies Actions;
