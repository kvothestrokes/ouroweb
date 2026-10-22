import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { listProducts, setProductActive } from '#lib/server/products.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const products = await listProducts(locals.supabase);
	if (!products) error(500, 'No pudimos cargar los productos.');
	return { products };
};

export const actions = {
	activo: async ({ request, locals }) => {
		const form = await request.formData();
		const id = z.uuid().safeParse(form.get('id'));
		if (!id.success) return fail(400, { message: 'Ese producto no existe.' });
		const problem = await setProductActive(locals.supabase, id.data, form.get('activo') === 'true');
		if (problem) return fail(400, { message: problem });
		return { success: 'Estado actualizado.' };
	}
} satisfies Actions;
