import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { garmentTypeFromForm, type SizeGuide } from '#lib/domain/garment-type.js';
import type { Actions, PageServerLoad } from './$types';

async function findType(locals: App.Locals, id: string) {
	if (!z.uuid().safeParse(id).success) return null;
	const { data } = await locals.supabase
		.from('garment_types')
		.select(
			'id, nombre, tallas, recargos_talla, guia_tallas, precio_normal, precio_mayoreo, mayoreo_cantidad_min'
		)
		.eq('id', id)
		.maybeSingle();
	return data;
}

function numbers(value: unknown): Record<string, number> {
	if (typeof value !== 'object' || value === null) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
	);
}

function guide(value: unknown): SizeGuide {
	if (typeof value !== 'object' || value === null) return {};
	const result: SizeGuide = {};
	for (const [talla, item] of Object.entries(value)) {
		const { ancho_cm, largo_cm } = (item ?? {}) as Record<string, unknown>;
		if (typeof ancho_cm === 'number' && typeof largo_cm === 'number') {
			result[talla] = { ancho_cm, largo_cm };
		}
	}
	return result;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const type = await findType(locals, params.id);
	if (!type) error(404, 'Tipo de prenda no encontrado');
	return {
		type: {
			id: type.id,
			nombre: type.nombre,
			tallas: type.tallas,
			recargos: numbers(type.recargos_talla),
			guia: guide(type.guia_tallas),
			precioNormal: type.precio_normal,
			precioMayoreo: type.precio_mayoreo,
			mayoreoMin: type.mayoreo_cantidad_min
		}
	};
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const type = await findType(locals, params.id);
		if (!type) return fail(404, { message: 'Tipo de prenda no encontrado.' });

		const form = await request.formData();
		// The name maps to the photo folder of its bases, so it is fixed after creation.
		form.set('nombre', type.nombre);
		const input = garmentTypeFromForm(form);
		if (!input.ok) return fail(400, { message: input.message });

		const {
			tallas,
			recargos_talla,
			guia_tallas,
			precio_normal,
			precio_mayoreo,
			mayoreo_cantidad_min
		} = input.value;
		const { error: updateError } = await locals.supabase
			.from('garment_types')
			.update({
				tallas,
				recargos_talla,
				guia_tallas,
				precio_normal,
				precio_mayoreo,
				mayoreo_cantidad_min
			})
			.eq('id', type.id);
		if (updateError)
			return fail(500, { message: 'No pudimos guardar los cambios. Intenta de nuevo.' });
		return { success: 'Cambios guardados.' };
	},

	eliminar: async ({ locals, params }) => {
		const { error: deleteError } = await locals.supabase
			.from('garment_types')
			.delete()
			.eq('id', params.id);
		if (deleteError) {
			const message =
				deleteError.code === '23503'
					? 'No se puede eliminar: tiene prendas base o productos.'
					: 'No pudimos eliminarla. Intenta de nuevo.';
			return fail(400, { message });
		}
		redirect(303, '/admin/tipos-de-prenda');
	}
} satisfies Actions;
