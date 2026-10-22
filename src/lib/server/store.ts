import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import {
	type StoreCollection,
	toProductDetail,
	toStoreProduct,
	type ProductDetail,
	type StoreCategoryTree,
	type StoreProduct,
	type StoreProductRow
} from '#lib/domain/store-product.js';
import type { Database } from '#lib/types/database.js';
import { toTree } from './categories.js';

export type { StoreCategoryTree, StoreCollection } from '#lib/domain/store-product.js';

/**
 * Anonymous client for the store: always reads as the public (RLS), even when the admin is
 * signed in, so the store never shows hidden products and its pages are safe to cache.
 */
const db = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

/** The anonymous client, for server code that must read exactly what the public may. */
export const publicDb = () => db;

// Never select design ids or ImageKit paths here: this data goes to the browser.
const STORE_PRODUCT_SELECT = `
	id, slug, nombre, descripcion, category_id, tipo_imagen, precio_base, modo_stock,
	permite_personalizar, destacado, created_at, updated_at,
	garment_types(nombre, tallas, recargos_talla, guia_tallas, precio_normal, precio_mayoreo, mayoreo_cantidad_min),
	product_colors(garment_bases(id, color_nombre, color_hex, foto)),
	product_images(id, orden),
	product_stock(garment_base_id, talla, cantidad),
	product_collections(collections(slug, nombre))
`;

export class StoreUnavailableError extends Error {}

function unwrap<T>(result: { data: T | null; error: unknown }): T {
	if (result.error || result.data === null) throw new StoreUnavailableError();
	return result.data;
}

/** Active categories as a two-level tree, in display order. */
export async function loadCategoryTree(): Promise<StoreCategoryTree> {
	const rows = unwrap(
		await db
			.from('categories')
			.select('id, slug, nombre, parent_id, es_estrella, orden, activo')
			.order('orden')
			.order('nombre')
	);
	return toTree(rows);
}

/** Every active product, newest first. The catalog is small enough to filter in memory. */
export async function loadStoreProducts(): Promise<StoreProduct[]> {
	const rows = unwrap(
		await db
			.from('products')
			.select(STORE_PRODUCT_SELECT)
			.order('created_at', { ascending: false })
			.order('orden', { referencedTable: 'product_images' })
	);
	return (rows as unknown as StoreProductRow[]).map(toStoreProduct);
}

/** Public products (all, or by slug) with everything needed to price an order. */
export async function loadProductDetails(slugs?: string[]): Promise<ProductDetail[]> {
	const query = db.from('products').select(STORE_PRODUCT_SELECT);
	const rows = unwrap(await (slugs ? query.in('slug', slugs) : query));
	return (rows as unknown as StoreProductRow[]).map(toProductDetail);
}

export async function loadProductDetail(slug: string): Promise<ProductDetail | null> {
	const row = unwrap(
		await db
			.from('products')
			.select(STORE_PRODUCT_SELECT)
			.eq('slug', slug)
			.order('orden', { referencedTable: 'product_images' })
			.limit(1)
	)[0];
	return row ? toProductDetail(row as unknown as StoreProductRow) : null;
}

export async function loadCollections(): Promise<StoreCollection[]> {
	return unwrap(await db.from('collections').select('id, slug, nombre').order('nombre'));
}

export type StoreRequestType = { id: string; nombre: string; precio_desde: number | null };

/** Visible special request types (spec 6.2), by name. */
export async function loadCustomRequestTypes(): Promise<StoreRequestType[]> {
	return unwrap(
		await db.from('custom_request_types').select('id, nombre, precio_desde').order('nombre')
	);
}

export type StoreReview = {
	id: string;
	calificacion: number;
	texto: string;
	productId: string | null;
	creado: string;
	/** Photo URL through /img/r, when the review has one. */
	foto: string | null;
};

/** Approved reviews, newest first (RLS only returns approved ones). */
export async function loadReviews(productId?: string): Promise<StoreReview[]> {
	let query = db
		.from('reviews')
		.select('id, calificacion, texto, tiene_foto, product_id, created_at, updated_at')
		.order('created_at', { ascending: false })
		.limit(30);
	if (productId) query = query.eq('product_id', productId);
	return unwrap(await query).map((review) => ({
		id: review.id,
		calificacion: review.calificacion,
		texto: review.texto,
		productId: review.product_id,
		creado: review.created_at,
		foto: review.tiene_foto ? `/img/r/${review.id}?v=${Date.parse(review.updated_at)}` : null
	}));
}

export type GalleryItem = { id: string; titulo: string; coleccion: string | null; src: string };

export async function loadGallery(): Promise<GalleryItem[]> {
	const rows = unwrap(
		await db
			.from('gallery_items')
			.select('id, titulo, updated_at, collections(slug)')
			.order('orden')
			.order('created_at', { ascending: false })
	);
	return rows.map((item) => ({
		id: item.id,
		titulo: item.titulo,
		coleccion: item.collections?.slug ?? null,
		src: `/img/g/${item.id}?v=${Date.parse(item.updated_at)}`
	}));
}

/**
 * True when the public can see the product (active, in visible categories). Image
 * endpoints read with the secret key, so they ask RLS through this anonymous client.
 */
export async function isPublicProduct(id: string): Promise<boolean> {
	const { data } = await db.from('products').select('id').eq('id', id).maybeSingle();
	return Boolean(data);
}

/**
 * Short CDN cache for public pages. Store loads must never touch the visitor's session
 * (`locals.supabase.auth`, `locals.getAdmin()`): a refreshed cookie would end up in a
 * response the CDN shares with everyone. Favorites and cart live in the browser.
 */
export const STORE_PAGE_HEADERS = {
	'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
};

/** Runs store reads, turning a database outage into a friendly 503 page. */
export async function storeData<T>(load: () => Promise<T>): Promise<T> {
	try {
		return await load();
	} catch (cause) {
		if (cause instanceof StoreUnavailableError) {
			error(503, 'La tienda no está disponible por ahora. Intenta de nuevo en unos minutos.');
		}
		throw cause;
	}
}
