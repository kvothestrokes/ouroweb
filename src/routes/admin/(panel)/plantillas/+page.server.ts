import { error, fail } from '@sveltejs/kit';
import { cleanText } from '#lib/domain/checkout.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [{ data: templates, error: templatesError }, { data: settings, error: settingsError }] =
		await Promise.all([
			locals.supabase.from('wa_templates').select('clave, nombre, cuerpo').order('nombre'),
			locals.supabase
				.from('settings')
				.select('datos_bancarios, direccion_taller, horarios, anticipo_sugerido_pct')
				.single()
		]);
	if (templatesError || settingsError) error(500, 'No pudimos cargar las plantillas.');
	return { templates, settings };
};

function field(form: FormData, name: string, max: number): string {
	return cleanText(String(form.get(name) ?? ''), true).slice(0, max);
}

export const actions = {
	plantilla: async ({ request, locals }) => {
		const form = await request.formData();
		const clave = String(form.get('clave') ?? '');
		const cuerpo = field(form, 'cuerpo', 2000);
		if (!/^[a-z_]{1,40}$/.test(clave)) return fail(400, { message: 'Revisa la plantilla.' });
		if (!cuerpo) return fail(400, { message: 'La plantilla no puede quedar vacía.' });
		const { data, error: updateError } = await locals.supabase
			.from('wa_templates')
			.update({ cuerpo })
			.eq('clave', clave)
			.select('nombre')
			.maybeSingle();
		if (updateError || !data) return fail(400, { message: 'No pudimos guardar la plantilla.' });
		return { success: `Plantilla «${data.nombre}» guardada.` };
	},

	negocio: async ({ request, locals }) => {
		const form = await request.formData();
		const pct = Number(form.get('anticipo_sugerido_pct'));
		if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
			return fail(400, { message: 'El anticipo sugerido es un porcentaje de 0 a 100.' });
		}
		const { error: updateError } = await locals.supabase
			.from('settings')
			.update({
				datos_bancarios: field(form, 'datos_bancarios', 500),
				direccion_taller: field(form, 'direccion_taller', 300),
				horarios: field(form, 'horarios', 200),
				anticipo_sugerido_pct: pct
			})
			.eq('id', true);
		if (updateError) return fail(400, { message: 'No pudimos guardar los datos del negocio.' });
		return { success: 'Datos del negocio guardados.' };
	}
} satisfies Actions;
