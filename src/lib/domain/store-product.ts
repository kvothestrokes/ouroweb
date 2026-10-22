import type { CategoryRow } from './catalog.js';
import type { FilterableProduct } from './catalog-filters.js';
import type { SizeGuide } from './garment-type.js';
import { basePrice } from './pricing.js';

/** Shape of the public catalog query (`STORE_PRODUCT_SELECT` in `src/lib/server/store.ts`). */
export type StoreProductRow = {
	id: string;
	slug: string;
	nombre: string;
	descripcion: string;
	category_id: string;
	tipo_imagen: 'mockup' | 'foto';
	precio_base: number | null;
	modo_stock: 'stock' | 'bajo_pedido';
	permite_personalizar: boolean;
	destacado: boolean;
	created_at: string;
	updated_at: string;
	garment_types: {
		nombre: string;
		tallas: string[];
		recargos_talla: unknown;
		guia_tallas: unknown;
		precio_normal: number | null;
		precio_mayoreo: number | null;
		mayoreo_cantidad_min: number | null;
	} | null;
	product_colors: {
		garment_bases: { id: string; color_nombre: string; color_hex: string; foto: string } | null;
	}[];
	product_images: { id: string; orden: number }[];
	product_stock: { garment_base_id: string; talla: string; cantidad: number }[];
	product_collections: { collections: { slug: string; nombre: string } | null }[];
};

export type ColorOption = { key: string; nombre: string; hex: string; baseId: string };

export type StoreProduct = FilterableProduct & {
	id: string;
	categoryId: string;
	tipoImagen: 'mockup' | 'foto';
	colorOptions: ColorOption[];
	/** Name of the first collection, shown as the fandom badge. */
	fandom: string | null;
	bajoPedido: boolean;
	destacado: boolean;
	/** Changes whenever the product is saved, so image URLs bust the CDN cache. */
	version: number;
	photoIds: string[];
};

export type ProductDetail = StoreProduct & {
	descripcion: string;
	precioBase: number | null;
	/** Surcharge in cents per size. */
	recargos: Record<string, number>;
	guiaTallas: SizeGuide;
	mayoreo: { precio: number; cantidadMin: number } | null;
	permitePersonalizar: boolean;
	/** Garment type name (`Playera`), null for non-garment products. */
	prenda: string | null;
	/** All sizes of the garment type, in order. */
	todasLasTallas: string[];
	/** Pieces per `<baseId>:<size>` (stock products only). */
	stock: Record<string, number>;
};

export type ProductImage = { key: string; src: string; version: number };

const COLOR_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** `playera/gris-jaspe` → `gris-jaspe`. */
function colorKey(foto: string): string | null {
	const key = foto.split('/')[1];
	return key && COLOR_KEY.test(key) ? key : null;
}

function centsRecord(value: unknown): Record<string, number> {
	if (!value || typeof value !== 'object') return {};
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] >= 0
		)
	);
}

function stockKey(baseId: string, size: string) {
	return `${baseId}:${size}`;
}

export function toStoreProduct(row: StoreProductRow): StoreProduct {
	const colorOptions = row.product_colors.flatMap(({ garment_bases: base }) => {
		const key = base && colorKey(base.foto);
		return base && key
			? [{ key, nombre: base.color_nombre, hex: base.color_hex, baseId: base.id }]
			: [];
	});
	const collections = row.product_collections.flatMap(({ collections }) =>
		collections ? [collections] : []
	);
	const inStockMode = row.modo_stock === 'stock';
	const stocked = row.product_stock.filter((entry) => entry.cantidad > 0);
	const allSizes = row.garment_types?.tallas ?? [];
	const tallas = inStockMode
		? allSizes.filter((size) => stocked.some((entry) => entry.talla === size))
		: allSizes;

	const base = basePrice(row, row.garment_types);
	const surcharges = centsRecord(row.garment_types?.recargos_talla);
	const lowestSurcharge = tallas.length
		? Math.min(...tallas.map((size) => surcharges[size] ?? 0))
		: 0;

	return {
		id: row.id,
		slug: row.slug,
		nombre: row.nombre,
		categoryId: row.category_id,
		tipoImagen: row.tipo_imagen,
		precio: base === null ? null : base + lowestSurcharge,
		colores: colorOptions.map((color) => color.key),
		colorOptions,
		tallas,
		colecciones: collections.map((collection) => collection.slug),
		fandom: collections[0]?.nombre ?? null,
		enStock: inStockMode && stocked.length > 0,
		bajoPedido: !inStockMode,
		destacado: row.destacado,
		creado: row.created_at,
		version: Date.parse(row.updated_at),
		photoIds: [...row.product_images].sort((a, b) => a.orden - b.orden).map((image) => image.id)
	};
}

export function toProductDetail(row: StoreProductRow): ProductDetail {
	const type = row.garment_types;
	const guide = type?.guia_tallas;
	return {
		...toStoreProduct(row),
		descripcion: row.descripcion,
		precioBase: basePrice(row, type),
		recargos: centsRecord(type?.recargos_talla),
		guiaTallas: guide && typeof guide === 'object' ? (guide as SizeGuide) : {},
		// TODO(negocio): without a minimum quantity the bulk price cannot be offered yet.
		mayoreo:
			type?.precio_mayoreo != null && type.mayoreo_cantidad_min != null
				? { precio: type.precio_mayoreo, cantidadMin: type.mayoreo_cantidad_min }
				: null,
		permitePersonalizar: row.permite_personalizar,
		prenda: type?.nombre ?? null,
		todasLasTallas: type?.tallas ?? [],
		stock: Object.fromEntries(
			row.product_stock.map((entry) => [
				stockKey(entry.garment_base_id, entry.talla),
				entry.cantidad
			])
		)
	};
}

/** Sizes that can be ordered in a color: all of them, or those with stock. */
export function availableSizes(product: ProductDetail, color: string | null): string[] {
	if (product.bajoPedido) return product.todasLasTallas;
	const base = product.colorOptions.find((option) => option.key === color);
	if (!base) return [];
	return product.todasLasTallas.filter(
		(size) => (product.stock[stockKey(base.baseId, size)] ?? 0) > 0
	);
}

/** Mockup per color, or the real photos in order. */
export function productImages(product: StoreProduct): ProductImage[] {
	if (product.tipoImagen === 'mockup') {
		return product.colorOptions.map((color) => ({
			key: color.key,
			src: `/img/p/${product.slug}/${color.key}`,
			version: product.version
		}));
	}
	return product.photoIds.map((id) => ({ key: id, src: `/img/f/${id}`, version: product.version }));
}

/** Widths served by `/img/*` (must match `STORE_IMAGE_WIDTHS` on the server). */
export const IMAGE_WIDTHS = [400, 800, 1000] as const;

export function imageUrl(image: ProductImage, width: (typeof IMAGE_WIDTHS)[number]): string {
	return `${image.src}?w=${width}&v=${image.version}`;
}

export function imageSrcset(image: ProductImage): string {
	return IMAGE_WIDTHS.map((width) => `${imageUrl(image, width)} ${width}w`).join(', ');
}

export type StoreCategory = CategoryRow & { imagen_hero: string | null };
export type StoreCategoryTree = (StoreCategory & { children: StoreCategory[] })[];
export type StoreCollection = { id: string; slug: string; nombre: string; imagen: string | null };

/**
 * Facets for the filter panel, from the products being shown. Sizes keep the garment
 * type order (CH, M, G…), which is the order products list them in.
 */
export function facetsFor(products: StoreProduct[]) {
	const colors = new Map<string, ColorOption>();
	const sizes = new Set<string>();
	for (const product of products) {
		for (const color of product.colorOptions) {
			if (!colors.has(color.key)) colors.set(color.key, color);
		}
		for (const size of product.tallas) sizes.add(size);
	}
	return {
		colores: [...colors.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
		tallas: [...sizes],
		colecciones: [...new Set(products.flatMap((product) => product.colecciones))]
	};
}

/** The category a slug points to, its root and the ids whose products it shows. */
export function findCategory(tree: StoreCategoryTree, slug: string) {
	for (const root of tree) {
		if (root.slug === slug) {
			return {
				node: root as StoreCategory,
				root,
				ids: [root.id, ...root.children.map((c) => c.id)]
			};
		}
		const child = root.children.find((c) => c.slug === slug);
		if (child) return { node: child, root, ids: [child.id] };
	}
	return null;
}

export type Facets = ReturnType<typeof facetsFor>;
