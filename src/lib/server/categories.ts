import type { SupabaseClient } from '@supabase/supabase-js';
import {
	checkCategoryPlacement,
	type CategoryInput,
	type CategoryRow,
	type CategoryTree
} from '#lib/domain/catalog.js';
import type { Database } from '#lib/types/database.js';

type Db = SupabaseClient<Database>;

const COLUMNS = 'id, slug, nombre, parent_id, es_estrella, orden, activo';

export async function listCategories(db: Db): Promise<CategoryRow[] | null> {
	const { data, error } = await db
		.from('categories')
		.select(COLUMNS)
		.order('orden')
		.order('nombre');
	return error ? null : data;
}

export function toTree(rows: CategoryRow[]): CategoryTree {
	return rows
		.filter((row) => !row.parent_id)
		.map((root) => ({ ...root, children: rows.filter((row) => row.parent_id === root.id) }));
}

/** Postgres error codes turned into messages for the admin. */
function messageFor(code: string | undefined, fallback: string): string {
	if (code === '23505') return 'Ya existe una categoría con ese slug.';
	if (code === '23503') {
		return 'Tiene subcategorías o productos. Muévelos primero o mejor desactívala.';
	}
	return fallback;
}

/**
 * Creates (id null) or updates a category. A star subcategory replaces its parent's
 * current star (one star per parent, enforced by a unique index).
 * Returns the problem to show, or null on success.
 */
export async function saveCategory(
	db: Db,
	input: CategoryInput,
	id: string | null
): Promise<string | null> {
	const existing = await listCategories(db);
	if (!existing) return 'No pudimos revisar las categorías. Intenta de nuevo.';

	const problem = checkCategoryPlacement({ id, ...input }, existing);
	if (problem) return problem;

	if (input.es_estrella && input.parent_id) {
		const cleared = await clearStar(db, input.parent_id, id);
		if (cleared) return cleared;
	}

	const { error } = id
		? await db.from('categories').update(input).eq('id', id)
		: await db.from('categories').insert(input);
	return error
		? messageFor(error.code, 'No pudimos guardar la categoría. Intenta de nuevo.')
		: null;
}

/** Makes a subcategory its parent's star. */
export async function makeStar(db: Db, id: string): Promise<string | null> {
	const { data: category } = await db
		.from('categories')
		.select('id, parent_id')
		.eq('id', id)
		.maybeSingle();
	if (!category) return 'Esa categoría no existe.';
	if (!category.parent_id) return 'Solo una subcategoría puede ser la estrella de su categoría.';

	const cleared = await clearStar(db, category.parent_id, id);
	if (cleared) return cleared;
	const { error } = await db.from('categories').update({ es_estrella: true }).eq('id', id);
	return error ? 'No pudimos marcarla como estrella. Intenta de nuevo.' : null;
}

async function clearStar(db: Db, parentId: string, keepId: string | null): Promise<string | null> {
	let query = db
		.from('categories')
		.update({ es_estrella: false })
		.eq('parent_id', parentId)
		.eq('es_estrella', true);
	if (keepId) query = query.neq('id', keepId);
	const { error } = await query;
	return error ? 'No pudimos cambiar la categoría estrella. Intenta de nuevo.' : null;
}

export async function setCategoryActive(
	db: Db,
	id: string,
	activo: boolean
): Promise<string | null> {
	const { error } = await db.from('categories').update({ activo }).eq('id', id);
	return error ? 'No pudimos cambiar el estado. Intenta de nuevo.' : null;
}

export async function deleteCategory(db: Db, id: string): Promise<string | null> {
	const { error } = await db.from('categories').delete().eq('id', id);
	return error ? messageFor(error.code, 'No pudimos eliminarla. Intenta de nuevo.') : null;
}
