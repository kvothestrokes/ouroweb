import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { deleteImageByPath, signedImageUrl } from '#lib/server/imagekit.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error: loadError } = await locals.supabase
		.from('reviews')
		.select(
			'id, calificacion, texto, foto_path, aprobada, created_at, orders(id, folio, cliente_nombre), products(nombre)'
		)
		.order('aprobada')
		.order('created_at', { ascending: false })
		.limit(200);
	if (loadError) error(500, 'No pudimos cargar las reseñas.');
	return {
		reviews: data.map(({ foto_path, ...review }) => ({
			...review,
			foto: foto_path ? signedImageUrl(foto_path, [{ width: 400 }]) : null
		}))
	};
};

function idFrom(form: FormData): string | null {
	const id = form.get('id');
	return typeof id === 'string' && z.uuid().safeParse(id).success ? id : null;
}

export const actions = {
	aprobar: async ({ request, locals }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { message: 'Revisa la reseña.' });
		const aprobada = form.get('aprobada') === 'true';
		const { error: updateError } = await locals.supabase
			.from('reviews')
			.update({ aprobada })
			.eq('id', id);
		if (updateError) return fail(400, { message: 'No pudimos actualizar la reseña.' });
		return { success: aprobada ? 'Reseña publicada.' : 'Reseña oculta.' };
	},
	eliminar: async ({ request, locals }) => {
		const id = idFrom(await request.formData());
		if (!id) return fail(400, { message: 'Revisa la reseña.' });
		const { data } = await locals.supabase
			.from('reviews')
			.delete()
			.eq('id', id)
			.select('foto_path')
			.maybeSingle();
		if (!data) return fail(400, { message: 'No pudimos eliminar la reseña.' });
		if (data.foto_path) await deleteImageByPath(data.foto_path);
		return { success: 'Reseña eliminada.' };
	}
} satisfies Actions;
