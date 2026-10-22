import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductInput, ProductRecord } from '#lib/domain/product.js';
import type { Database } from '#lib/types/database.js';
import { deleteImageByPath, signedImageUrl } from './imagekit.js';

type Db = SupabaseClient<Database>;

/** Everything the product form needs to offer its choices. */
export async function loadProductContext(db: Db) {
	const [types, bases, categories, designs, collections] = await Promise.all([
		db.from('garment_types').select('id, nombre, tallas, precio_normal').order('nombre'),
		db
			.from('garment_bases')
			.select('id, garment_type_id, color_nombre, color_hex, es_clara')
			.order('color_nombre'),
		db.from('categories').select('id, nombre, parent_id, activo').order('orden').order('nombre'),
		db.from('designs').select('id, nombre').order('nombre'),
		db.from('collections').select('id, nombre').order('nombre')
	]);
	if (types.error || bases.error || categories.error || designs.error || collections.error)
		return null;

	const roots = categories.data.filter((category) => !category.parent_id);
	return {
		garmentTypes: types.data,
		bases: bases.data,
		// Grouped for the select: each main category with its subcategories.
		categoryGroups: roots.map((root) => ({
			id: root.id,
			nombre: root.nombre,
			children: categories.data
				.filter((category) => category.parent_id === root.id)
				.map(({ id, nombre }) => ({ id, nombre }))
		})),
		designs: designs.data,
		collections: collections.data
	};
}

export type ProductContextData = NonNullable<Awaited<ReturnType<typeof loadProductContext>>>;

/** Thumbnail for a photo product: resized through a signed ImageKit URL. */
export function photoThumbnail(path: string, width = 400): string {
	return signedImageUrl(path, [{ width, quality: 80, format: 'auto' }]);
}

export async function listProducts(db: Db) {
	const { data, error } = await db
		.from('products')
		.select(
			`id, nombre, slug, tipo_imagen, design_id, precio_base, modo_stock, activo, destacado,
			categories(nombre),
			garment_types(nombre, precio_normal),
			product_colors(garment_base_id),
			product_images(imagekit_path, orden)`
		)
		.order('created_at', { ascending: false });
	if (error) return null;

	return data.map((product) => {
		const firstImage = [...product.product_images].sort((a, b) => a.orden - b.orden)[0];
		return {
			id: product.id,
			nombre: product.nombre,
			slug: product.slug,
			categoria: product.categories?.nombre ?? '—',
			tipoPrenda: product.garment_types?.nombre ?? null,
			precioBase: product.precio_base,
			precioPrenda: product.garment_types?.precio_normal ?? null,
			modoStock: product.modo_stock,
			activo: product.activo,
			destacado: product.destacado,
			tipoImagen: product.tipo_imagen,
			// Mockup thumbnails come from the admin mockup endpoint; photos from ImageKit.
			mockup:
				product.tipo_imagen === 'mockup' && product.design_id && product.product_colors[0]
					? { designId: product.design_id, baseId: product.product_colors[0].garment_base_id }
					: null,
			photo: firstImage ? photoThumbnail(firstImage.imagekit_path) : null
		};
	});
}

export async function loadProduct(db: Db, id: string) {
	const { data } = await db
		.from('products')
		.select(
			`id, nombre, slug, descripcion, category_id, tipo_imagen, garment_type_id, design_id,
			precio_base, modo_stock, permite_personalizar, activo, destacado,
			product_colors(garment_base_id),
			product_collections(collection_id),
			product_stock(garment_base_id, talla, cantidad),
			product_images(id, imagekit_path, orden)`
		)
		.eq('id', id)
		.maybeSingle();
	if (!data) return null;

	const { product_colors, product_collections, product_stock, product_images, ...product } = data;
	return {
		product: product as ProductRecord & { id: string },
		colors: product_colors.map((row) => row.garment_base_id),
		collections: product_collections.map((row) => row.collection_id),
		stock: Object.fromEntries(
			product_stock.map((row) => [`${row.garment_base_id}.${row.talla}`, row.cantidad])
		) as Record<string, number>,
		images: [...product_images]
			.sort((a, b) => a.orden - b.orden)
			.map((image) => ({
				id: image.id,
				path: image.imagekit_path,
				url: photoThumbnail(image.imagekit_path)
			}))
	};
}

export type SaveResult = { ok: true; id: string } | { ok: false; message: string };

/** Creates (id null) or updates a product and its children in one transaction. */
export async function saveProduct(
	db: Db,
	input: ProductInput,
	id: string | null
): Promise<SaveResult> {
	const { data, error } = await db.rpc('save_product', {
		// The generated types mark p_id as non-null; null is how the function creates.
		p_id: id as string,
		p_product: input.product,
		p_colors: input.colors,
		p_collections: input.collections,
		p_stock: input.stock
	});
	if (error) {
		const message =
			error.code === '23505' && error.message.includes('slug')
				? 'Ya existe un producto con ese slug.'
				: error.code === '23514'
					? 'Revisa los colores, el precio y el inventario del producto.'
					: error.code === 'P0002'
						? 'Producto no encontrado.'
						: 'No pudimos guardar el producto. Intenta de nuevo.';
		return { ok: false, message };
	}
	return { ok: true, id: data };
}

export async function setProductActive(
	db: Db,
	id: string,
	activo: boolean
): Promise<string | null> {
	const { error } = await db.from('products').update({ activo }).eq('id', id);
	return error ? 'No pudimos cambiar el estado. Intenta de nuevo.' : null;
}

/** Orders keep their snapshot (order_items.product_id is set to null). */
export async function deleteProduct(db: Db, id: string): Promise<string | null> {
	const { data: images } = await db
		.from('product_images')
		.select('imagekit_path')
		.eq('product_id', id);
	const { data: deleted, error } = await db.from('products').delete().eq('id', id).select('id');
	if (error || deleted.length === 0) return 'No pudimos eliminarlo. Intenta de nuevo.';
	await Promise.all((images ?? []).map((image) => deleteImageByPath(image.imagekit_path)));
	return null;
}
