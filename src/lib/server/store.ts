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
