import { error, fail } from '@sveltejs/kit';
import { DEFAULT_PRINT_AREA } from '#lib/domain/print-area.js';
import { colorLabel, sampleColor } from '#lib/server/garment-colors.js';
import { baseColors, garmentTypeSlug, loadBase } from '#lib/server/garment-assets.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [types, bases] = await Promise.all([
		locals.supabase.from('garment_types').select('id, nombre').order('nombre'),
		locals.supabase
			.from('garment_bases')
			.select('id, garment_type_id, color_nombre, color_hex, foto, es_clara')
			.order('color_nombre')
	]);
	if (types.error || bases.error) error(500, 'No pudimos cargar las prendas base.');

	return {
		types: types.data.map((type) => {
			const tipo = garmentTypeSlug(type.nombre);
			const own = bases.data.filter((base) => base.garment_type_id === type.id);
			const registered = new Set(own.map((base) => base.foto));
			return {
				id: type.id,
				nombre: type.nombre,
				tipo,
				bases: own,
				pendingPhotos: baseColors(tipo).filter((color) => !registered.has(`${tipo}/${color}`))
			};
		})
	};
};

export const actions = {
	/** Registers every local photo of a garment type that has no base yet. */
	registrar: async ({ request, locals }) => {
		const typeId = String((await request.formData()).get('garment_type_id') ?? '');
		const { data: type } = await locals.supabase
			.from('garment_types')
			.select('id, nombre')
			.eq('id', typeId)
			.maybeSingle();
		if (!type) return fail(400, { message: 'Ese tipo de prenda no existe.' });

		const tipo = garmentTypeSlug(type.nombre);
		const { data: existing, error: existingError } = await locals.supabase
			.from('garment_bases')
			.select('foto')
			.eq('garment_type_id', type.id);
		if (existingError) return fail(500, { message: 'No pudimos revisar las fotos registradas.' });

		const registered = new Set(existing.map((base) => base.foto));
		const pending = baseColors(tipo).filter((color) => !registered.has(`${tipo}/${color}`));
		if (pending.length === 0) return { registered: 0 };

		const rows = await Promise.all(
			pending.map(async (color) => {
				const photo = await loadBase(tipo, color);
				if (!photo) throw new Error(`missing photo ${tipo}/${color}`);
				const { hex, isLight } = await sampleColor(photo);
				return {
					garment_type_id: type.id,
					color_nombre: colorLabel(color),
					color_hex: hex,
					es_clara: isLight,
					foto: `${tipo}/${color}`,
					area_impresion: DEFAULT_PRINT_AREA
				};
			})
		);

		const { error: insertError } = await locals.supabase.from('garment_bases').insert(rows);
		if (insertError)
			return fail(500, { message: 'No pudimos registrar las fotos. Intenta de nuevo.' });
		return { registered: rows.length };
	}
} satisfies Actions;
