import { error, fail, redirect } from '@sveltejs/kit';
import sharp from 'sharp';
import { z } from 'zod';
import { DEFAULT_PRINT_AREA, parsePrintArea, printAreaFromForm } from '#lib/domain/print-area.js';
import { loadBase, parseFotoKey } from '#lib/server/garment-assets.js';
import { SAMPLE_DESIGN_RATIO } from '#lib/server/sample-design.js';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const details = z.object({
	color_nombre: z.string().trim().min(1).max(40),
	color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

async function findBase(locals: App.Locals, id: string) {
	if (!UUID.test(id)) return null;
	const { data } = await locals.supabase
		.from('garment_bases')
		.select(
			'id, garment_type_id, color_nombre, color_hex, foto, es_clara, area_impresion, garment_types(nombre)'
		)
		.eq('id', id)
		.maybeSingle();
	return data;
}

async function photoSize(foto: string) {
	const key = parseFotoKey(foto);
	const photo = key ? await loadBase(key.tipo, key.color) : null;
	if (!photo) return null;
	const { width = 0, height = 0 } = await sharp(photo).metadata();
	return { width, height };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const base = await findBase(locals, params.id);
	if (!base) error(404, 'Prenda base no encontrada');
	const photo = await photoSize(base.foto);
	if (!photo) error(404, 'La foto de esta prenda base ya no está en el proyecto');

	const [tipo, color] = base.foto.split('/');
	return {
		base: {
			id: base.id,
			colorNombre: base.color_nombre,
			colorHex: base.color_hex,
			esClara: base.es_clara,
			area: parsePrintArea(base.area_impresion) ?? DEFAULT_PRINT_AREA,
			tipoNombre: base.garment_types?.nombre ?? 'Prenda',
			tipo,
			color
		},
		photo,
		designRatio: SAMPLE_DESIGN_RATIO
	};
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const base = await findBase(locals, params.id);
		if (!base) return fail(404, { message: 'Prenda base no encontrada.' });
		const photo = await photoSize(base.foto);
		if (!photo)
			return fail(404, { message: 'La foto de esta prenda base ya no está en el proyecto.' });

		const form = await request.formData();
		const parsed = details.safeParse({
			color_nombre: form.get('color_nombre'),
			color_hex: form.get('color_hex')
		});
		if (!parsed.success) return fail(400, { message: 'Revisa el nombre y el color.' });

		const area = printAreaFromForm(form, photo);
		if (!area.ok) return fail(400, { message: area.message });

		const { error: updateError } = await locals.supabase
			.from('garment_bases')
			.update({
				color_nombre: parsed.data.color_nombre,
				color_hex: parsed.data.color_hex.toLowerCase(),
				es_clara: form.get('es_clara') === 'on',
				area_impresion: area.area
			})
			.eq('id', base.id);
		if (updateError) {
			const message =
				updateError.code === '23505'
					? 'Ya hay otro color con ese nombre en esta prenda.'
					: 'No pudimos guardar los cambios. Intenta de nuevo.';
			return fail(400, { message });
		}

		// All supplier photos share the same framing, so one area usually fits every color.
		let alsoUpdated = 0;
		if (form.get('aplicar_a_todos') === 'on') {
			const { data, error: bulkError } = await locals.supabase
				.from('garment_bases')
				.update({ area_impresion: area.area })
				.eq('garment_type_id', base.garment_type_id)
				.neq('id', base.id)
				.select('id');
			if (bulkError) {
				return fail(500, {
					message: 'Guardamos este color, pero no pudimos copiar el área a los demás.'
				});
			}
			alsoUpdated = data.length;
		}

		return { saved: true, alsoUpdated };
	},

	eliminar: async ({ locals, params }) => {
		const base = await findBase(locals, params.id);
		if (!base) return fail(404, { message: 'Prenda base no encontrada.' });

		const { error: deleteError } = await locals.supabase
			.from('garment_bases')
			.delete()
			.eq('id', base.id);
		if (deleteError) {
			const message =
				deleteError.code === '23503'
					? 'No se puede eliminar: hay productos que usan este color.'
					: 'No pudimos eliminarla. Intenta de nuevo.';
			return fail(400, { message });
		}
		redirect(303, '/admin/prendas-base');
	}
} satisfies Actions;
