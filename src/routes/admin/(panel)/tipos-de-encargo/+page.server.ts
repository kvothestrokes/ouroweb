import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { customRequestTypeFromForm } from '#lib/domain/custom-request.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('custom_request_types')
		.select('id, nombre, precio_desde, activo')
		.order('nombre');
	if (loadError) error(500, 'No pudimos cargar los tipos de encargo.');
	return { types: data };
};

function idFrom(form: FormData): string | null {
	const id = form.get('id');
	return typeof id === 'string' && z.uuid().safeParse(id).success ? id : null;
}

const DUPLICATE = 'Ya existe un tipo de encargo con ese nombre.';

export const actions = {
	crear: async ({ request, locals }) => {
		const input = customRequestTypeFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { error: saveError } = await locals.supabase
			.from('custom_request_types')
			.insert(input.value);
		if (saveError) {
			return fail(400, {
				message: saveError.code === '23505' ? DUPLICATE : 'No pudimos guardarlo. Intenta de nuevo.'
			});
		}
		return { success: `«${input.value.nombre}» agregado.` };
	},
	guardar: async ({ request, locals }) => {
		const form = await request.formData();
		const id = idFrom(form);
		const input = customRequestTypeFromForm(form);
		if (!id) return fail(400, { message: 'Revisa el tipo de encargo.' });
		if (!input.ok) return fail(400, { message: input.message });
		const { error: saveError } = await locals.supabase
			.from('custom_request_types')
			.update(input.value)
			.eq('id', id);
		if (saveError) {
			return fail(400, {
				message: saveError.code === '23505' ? DUPLICATE : 'No pudimos guardarlo. Intenta de nuevo.'
			});
		}
		return { success: `«${input.value.nombre}» guardado.` };
	},
	eliminar: async ({ request, locals }) => {
		const id = idFrom(await request.formData());
		if (!id) return fail(400, { message: 'Revisa el tipo de encargo.' });
		// Existing requests keep their description; their type becomes empty (on delete set null).
		const { error: deleteError } = await locals.supabase
			.from('custom_request_types')
			.delete()
			.eq('id', id);
		if (deleteError) return fail(400, { message: 'No pudimos eliminarlo. Intenta de nuevo.' });
		return { success: 'Tipo de encargo eliminado.' };
	}
} satisfies Actions;
