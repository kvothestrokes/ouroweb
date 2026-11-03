import type { SupabaseClient } from '@supabase/supabase-js';
import {
	PENDING_DESIGN_ID,
	rowSlug,
	type ImportCatalog,
	type ImportPlan,
	type ImportRow
} from '#lib/domain/product-import.js';
import type { ProductInput } from '#lib/domain/product.js';
import type { Database } from '#lib/types/database.js';
import { storeDesignFile, type StoredFile } from './designs.js';
import { deleteImageByPath } from './imagekit.js';
import { storeProductPhoto } from './product-photos.js';
import { saveProduct, type SaveResult } from './products.js';

type Db = SupabaseClient<Database>;

/**
 * Catalog for an import: small tables in full, and only the product slugs and design names
 * the rows mention (those tables can outgrow a single PostgREST page).
 */
export async function loadImportCatalog(db: Db, rows: ImportRow[]): Promise<ImportCatalog | null> {
	const slugs = [...new Set(rows.map(rowSlug).filter(Boolean))];
	const designNames = [
		...new Set(rows.map((row) => row.diseno_existente?.trim()).filter((name) => !!name))
	] as string[];

	const [categories, types, bases, collections, designs, products] = await Promise.all([
		db.from('categories').select('id, slug'),
		db.from('garment_types').select('id, nombre, tallas, precio_normal'),
		db.from('garment_bases').select('id, garment_type_id, color_nombre'),
		db.from('collections').select('id, slug'),
		designNames.length
			? db.from('designs').select('id, nombre').in('nombre', designNames)
			: Promise.resolve({ data: [], error: null }),
		slugs.length
			? db.from('products').select('slug').in('slug', slugs)
			: Promise.resolve({ data: [], error: null })
	]);
	if (
		categories.error ||
		types.error ||
		bases.error ||
		collections.error ||
		designs.error ||
		products.error
	) {
		return null;
	}
	return {
		categories: categories.data,
		garmentTypes: types.data,
		bases: bases.data,
		collections: collections.data,
		designs: designs.data,
		existingSlugs: products.data.map((product) => product.slug)
	};
}

/** Side effects of importing one row; injected so the rollback order can be tested. */
export type ImportDeps = {
	storeDesignFile(file: File): Promise<StoredFile>;
	storeProductPhoto(file: File): Promise<StoredFile>;
	insertDesign(row: {
		nombre: string;
		path_prenda_oscura: string | null;
		path_prenda_clara: string | null;
	}): Promise<string | null>;
	saveProduct(input: ProductInput): Promise<SaveResult>;
	insertImages(productId: string, paths: string[]): Promise<boolean>;
	deleteProduct(id: string): Promise<void>;
	deleteDesign(id: string): Promise<void>;
	deleteImage(path: string): Promise<unknown>;
};

export function importDeps(db: Db): ImportDeps {
	return {
		storeDesignFile,
		storeProductPhoto,
		async insertDesign(row) {
			const { data, error } = await db.from('designs').insert(row).select('id').single();
			return error ? null : data.id;
		},
		saveProduct: (input) => saveProduct(db, input, null),
		async insertImages(productId, paths) {
			const { error } = await db
				.from('product_images')
				.insert(
					paths.map((imagekit_path, orden) => ({ product_id: productId, imagekit_path, orden }))
				);
			return !error;
		},
		async deleteProduct(id) {
			await db.from('products').delete().eq('id', id);
		},
		async deleteDesign(id) {
			await db.from('designs').delete().eq('id', id);
		},
		deleteImage: deleteImageByPath
	};
}

export type ImportRowResult =
	{ ok: true; id: string; designId: string | null } | { ok: false; message: string };

/**
 * Creates one planned product: uploads its images to ImageKit, creates the design when the row
 * brings one (or links `reusedDesignId` if an earlier row in the same batch already created it),
 * saves the product and its photos. Any failure undoes what this row already did,
 * newest first; files the cleanup misses are caught later by the orphan sweep.
 */
export async function importPlannedRow(
	plan: ImportPlan,
	files: ReadonlyMap<string, File>,
	deps: ImportDeps,
	reusedDesignId: string | null = null
): Promise<ImportRowResult> {
	const names = [
		...(reusedDesignId ? [] : [plan.newDesign?.oscura, plan.newDesign?.clara]),
		...plan.fotos
	].filter((name): name is string => !!name);
	const missing = names.find((name) => !files.has(name));
	if (missing) return { ok: false, message: `Falta el archivo «${missing}».` };

	const uploaded: string[] = [];
	const undo: (() => Promise<unknown>)[] = [];
	const rollback = async (message: string): Promise<ImportRowResult> => {
		for (const step of undo.reverse()) await step();
		for (const path of uploaded) await deps.deleteImage(path);
		return { ok: false, message };
	};

	const upload = async (name: string, store: (file: File) => Promise<StoredFile>) => {
		const stored = await store(files.get(name)!);
		if (stored.ok) uploaded.push(stored.path);
		return stored.ok ? stored : { ok: false as const, message: `${name}: ${stored.message}` };
	};

	const input = structuredClone(plan.input);
	let createdDesignId: string | null = reusedDesignId;
	if (reusedDesignId && plan.newDesign) {
		input.product.design_id = reusedDesignId;
	} else if (plan.newDesign) {
		const paths: Record<'oscura' | 'clara', string | null> = { oscura: null, clara: null };
		for (const side of ['oscura', 'clara'] as const) {
			const name = plan.newDesign[side];
			if (!name) continue;
			const stored = await upload(name, deps.storeDesignFile);
			if (!stored.ok) return rollback(stored.message);
			paths[side] = stored.path;
		}
		const designId = await deps.insertDesign({
			nombre: plan.newDesign.nombre,
			path_prenda_oscura: paths.oscura,
			path_prenda_clara: paths.clara
		});
		if (!designId) return rollback('No pudimos guardar el diseño. Intenta de nuevo.');
		undo.push(() => deps.deleteDesign(designId));
		input.product.design_id = designId;
		createdDesignId = designId;
	} else if (input.product.design_id === PENDING_DESIGN_ID) {
		return { ok: false, message: 'Falta el diseño del producto.' };
	}

	const photos: string[] = [];
	for (const name of plan.fotos) {
		const stored = await upload(name, deps.storeProductPhoto);
		if (!stored.ok) return rollback(stored.message);
		photos.push(stored.path);
	}

	const saved = await deps.saveProduct(input);
	if (!saved.ok) return rollback(saved.message);
	undo.push(() => deps.deleteProduct(saved.id));

	if (photos.length && !(await deps.insertImages(saved.id, photos))) {
		return rollback('No pudimos guardar las fotos del producto. Intenta de nuevo.');
	}
	return { ok: true, id: saved.id, designId: createdDesignId };
}
