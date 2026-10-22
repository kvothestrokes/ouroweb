import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { productFromForm } from '#lib/domain/product.js';
import { deleteImageByPath } from '#lib/server/imagekit.js';
import { storeProductPhoto } from '#lib/server/product-photos.js';
import { pickedFile } from '#lib/server/designs.js';
import {
	deleteProduct,
	loadProduct,
	loadProductContext,
	saveProduct
} from '#lib/server/products.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_PHOTOS = 8;

function validId(id: string): boolean {
	return z.uuid().safeParse(id).success;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!validId(params.id)) error(404, 'Producto no encontrado');
	const [product, context] = await Promise.all([
		loadProduct(locals.supabase, params.id),
		loadProductContext(locals.supabase)
	]);
	if (!product) error(404, 'Producto no encontrado');
	if (!context) error(500, 'No pudimos cargar los datos del catálogo.');
	return { ...product, context, created: url.searchParams.has('creado') };
};

export const actions = {
	guardar: async ({ request, locals, params }) => {
		const context = await loadProductContext(locals.supabase);
		if (!context) return fail(500, { message: 'No pudimos cargar los datos del catálogo.' });

		const input = productFromForm(await request.formData(), context);
		if (!input.ok) return fail(400, { message: input.message });

		const saved = await saveProduct(locals.supabase, input.value, params.id);
		if (!saved.ok) return fail(400, { message: saved.message });
		return { success: 'Cambios guardados.' };
	},

	eliminar: async ({ locals, params }) => {
		const problem = await deleteProduct(locals.supabase, params.id);
		if (problem) return fail(400, { message: problem });
		redirect(303, '/admin/productos');
	},

	foto_subir: async ({ request, locals, params }) => {
		const file = pickedFile((await request.formData()).get('foto'));
		if (!file) return fail(400, { message: 'Elige una foto.' });

		const { data: images } = await locals.supabase
			.from('product_images')
			.select('orden')
			.eq('product_id', params.id);
		if ((images?.length ?? 0) >= MAX_PHOTOS) {
			return fail(400, { message: `Máximo ${MAX_PHOTOS} fotos por producto.` });
		}

		const stored = await storeProductPhoto(file);
		if (!stored.ok) return fail(400, { message: stored.message });

		const orden = Math.max(-1, ...(images ?? []).map((image) => image.orden)) + 1;
		const { error: insertError } = await locals.supabase
			.from('product_images')
			.insert({ product_id: params.id, imagekit_path: stored.path, orden });
		if (insertError) {
			await deleteImageByPath(stored.path);
			return fail(500, { message: 'No pudimos guardar la foto. Intenta de nuevo.' });
		}
		return { success: 'Foto agregada.' };
	},

	foto_eliminar: async ({ request, locals, params }) => {
		const imageId = String((await request.formData()).get('image_id') ?? '');
		if (!validId(imageId)) return fail(400, { message: 'Esa foto no existe.' });

		const { data: image } = await locals.supabase
			.from('product_images')
			.delete()
			.eq('id', imageId)
			.eq('product_id', params.id)
			.select('imagekit_path')
			.maybeSingle();
		if (!image) return fail(404, { message: 'Esa foto no existe.' });
		await deleteImageByPath(image.imagekit_path);
		return { success: 'Foto eliminada.' };
	},

	foto_mover: async ({ request, locals, params }) => {
		const form = await request.formData();
		const imageId = String(form.get('image_id') ?? '');
		const offset = form.get('direccion') === 'antes' ? -1 : 1;

		const { data: images } = await locals.supabase
			.from('product_images')
			.select('id, orden')
			.eq('product_id', params.id)
			.order('orden');
		const list = images ?? [];
		const index = list.findIndex((image) => image.id === imageId);
		const target = index + offset;
		if (index < 0 || target < 0 || target >= list.length) return { success: null };

		// Rewrite the order as positions, swapping the two photos.
		[list[index], list[target]] = [list[target], list[index]];
		const results = await Promise.all(
			list.map((image, orden) =>
				locals.supabase.from('product_images').update({ orden }).eq('id', image.id)
			)
		);
		if (results.some((result) => result.error)) {
			return fail(500, { message: 'No pudimos cambiar el orden. Intenta de nuevo.' });
		}
		return { success: null };
	}
} satisfies Actions;
