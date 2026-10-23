import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { cleanText } from '#lib/domain/checkout.js';
import { deleteImageByPath, signedImageUrl, uploadImage } from '#lib/server/imagekit.js';
import { preparePhoto } from '#lib/server/product-photos.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [{ data: items, error: itemsError }, { data: collections }] = await Promise.all([
		locals.supabase
			.from('gallery_items')
			.select('id, titulo, orden, imagekit_path, collection_id')
			.order('orden')
			.order('created_at', { ascending: false }),
		locals.supabase.from('collections').select('id, nombre').order('nombre')
	]);
	if (itemsError) error(500, 'No pudimos cargar la galería.');
	return {
		items: items.map(({ imagekit_path, ...item }) => ({
			...item,
			src: signedImageUrl(imagekit_path, [{ width: 400 }])
		})),
		collections: collections ?? []
	};
};

function collectionFrom(form: FormData): string | null {
	const id = form.get('collection_id');
	return typeof id === 'string' && z.uuid().safeParse(id).success ? id : null;
}

export const actions = {
	subir: async ({ request, locals }) => {
		const form = await request.formData();
		const file = form.get('foto');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { message: 'Elige una foto.' });
		const prepared = await preparePhoto(file);
		if (!prepared.ok) return fail(400, { message: prepared.message });
		let path: string;
		try {
			path = await uploadImage(
				new File([new Uint8Array(prepared.bytes)], 'trabajo.webp', { type: 'image/webp' }),
				'gallery'
			);
		} catch {
			return fail(503, { message: 'No pudimos subir la foto. Intenta de nuevo.' });
		}
		const { error: insertError } = await locals.supabase.from('gallery_items').insert({
			imagekit_path: path,
			titulo: cleanText(String(form.get('titulo') ?? '')).slice(0, 120),
			collection_id: collectionFrom(form)
		});
		if (insertError) {
			await deleteImageByPath(path);
			return fail(400, { message: 'No pudimos guardar la foto.' });
		}
		return { success: 'Foto agregada a la galería.' };
	},
	guardar: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const orden = Number(form.get('orden'));
		if (!z.uuid().safeParse(id).success || !Number.isInteger(orden) || orden < 0 || orden > 999) {
			return fail(400, { message: 'El orden debe ser un número de 0 a 999.' });
		}
		const { error: updateError } = await locals.supabase
			.from('gallery_items')
			.update({
				titulo: cleanText(String(form.get('titulo') ?? '')).slice(0, 120),
				collection_id: collectionFrom(form),
				orden
			})
			.eq('id', id);
		if (updateError) return fail(400, { message: 'No pudimos guardar los cambios.' });
		return { success: 'Cambios guardados.' };
	},
	eliminar: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Revisa la foto.' });
		const { data } = await locals.supabase
			.from('gallery_items')
			.delete()
			.eq('id', id)
			.select('imagekit_path')
			.maybeSingle();
		if (!data) return fail(400, { message: 'No pudimos eliminar la foto.' });
		await deleteImageByPath(data.imagekit_path);
		return { success: 'Foto eliminada.' };
	}
} satisfies Actions;
