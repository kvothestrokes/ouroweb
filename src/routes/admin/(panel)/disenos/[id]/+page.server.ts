import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { pickedFile, storeDesignFile } from '#lib/server/designs.js';
import { deleteImageByPath } from '#lib/server/imagekit.js';
import type { Actions, PageServerLoad } from './$types';

async function findDesign(locals: App.Locals, id: string) {
	if (!z.uuid().safeParse(id).success) return null;
	const { data } = await locals.supabase
		.from('designs')
		.select('id, nombre, path_prenda_oscura, path_prenda_clara')
		.eq('id', id)
		.maybeSingle();
	return data;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const design = await findDesign(locals, params.id);
	if (!design) error(404, 'Diseño no encontrado');

	const { data: bases, error: basesError } = await locals.supabase
		.from('garment_bases')
		.select('id, color_nombre, es_clara, garment_types(nombre)')
		.order('color_nombre');
	if (basesError) error(500, 'No pudimos cargar las prendas base.');

	const byType = new Map<string, { id: string; color: string; esClara: boolean }[]>();
	for (const base of bases) {
		const tipo = base.garment_types?.nombre ?? 'Prenda';
		byType.set(tipo, [
			...(byType.get(tipo) ?? []),
			{ id: base.id, color: base.color_nombre, esClara: base.es_clara }
		]);
	}

	return {
		design: {
			id: design.id,
			nombre: design.nombre,
			hasOscura: Boolean(design.path_prenda_oscura),
			hasClara: Boolean(design.path_prenda_clara)
		},
		previews: [...byType].map(([tipo, items]) => ({ tipo, items }))
	};
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const design = await findDesign(locals, params.id);
		if (!design) return fail(404, { message: 'Diseño no encontrado.' });

		const form = await request.formData();
		const nombre = String(form.get('nombre') ?? '').trim();
		if (!nombre || nombre.length > 80)
			return fail(400, { message: 'Escribe el nombre del diseño.' });

		const update: {
			nombre: string;
			path_prenda_oscura?: string | null;
			path_prenda_clara?: string | null;
		} = { nombre };
		const replaced: string[] = [];
		const uploaded: string[] = [];

		for (const [column, field] of [
			['path_prenda_oscura', 'oscura'],
			['path_prenda_clara', 'clara']
		] as const) {
			const file = pickedFile(form.get(field));
			if (!file) continue;
			const stored = await storeDesignFile(file);
			if (!stored.ok) {
				await Promise.all(uploaded.map(deleteImageByPath));
				return fail(400, { message: stored.message });
			}
			uploaded.push(stored.path);
			update[column] = stored.path;
			if (design[column]) replaced.push(design[column]);
		}

		if (
			form.get('quitar_clara') === 'on' &&
			!update.path_prenda_clara &&
			design.path_prenda_clara
		) {
			if (!design.path_prenda_oscura && !update.path_prenda_oscura) {
				return fail(400, { message: 'No puedes quitar la única versión del diseño.' });
			}
			update.path_prenda_clara = null;
			replaced.push(design.path_prenda_clara);
		}

		const { error: updateError } = await locals.supabase
			.from('designs')
			.update(update)
			.eq('id', design.id);
		if (updateError) {
			await Promise.all(uploaded.map(deleteImageByPath));
			return fail(500, { message: 'No pudimos guardar los cambios. Intenta de nuevo.' });
		}

		// Old files are removed only after the database points to the new ones.
		await Promise.all(replaced.map(deleteImageByPath));
		return { success: uploaded.length ? 'Diseño actualizado.' : 'Cambios guardados.' };
	},

	eliminar: async ({ locals, params }) => {
		const design = await findDesign(locals, params.id);
		if (!design) return fail(404, { message: 'Diseño no encontrado.' });

		const { error: deleteError } = await locals.supabase
			.from('designs')
			.delete()
			.eq('id', design.id);
		if (deleteError) {
			const message =
				deleteError.code === '23503'
					? 'No se puede eliminar: hay productos que usan este diseño.'
					: 'No pudimos eliminarlo. Intenta de nuevo.';
			return fail(400, { message });
		}
		await Promise.all(
			[design.path_prenda_oscura, design.path_prenda_clara]
				.filter((path): path is string => Boolean(path))
				.map(deleteImageByPath)
		);
		redirect(303, '/admin/disenos');
	}
} satisfies Actions;
