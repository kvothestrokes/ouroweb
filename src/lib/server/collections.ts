import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionInput } from '#lib/domain/catalog.js';
import type { Database } from '#lib/types/database.js';

type Db = SupabaseClient<Database>;

export type CollectionRow = CollectionInput & { id: string };

export async function listCollections(db: Db): Promise<CollectionRow[] | null> {
	const { data, error } = await db.from('collections').select('id, nombre, slug').order('nombre');
	return error ? null : data;
}

function messageFor(code: string | undefined, fallback: string): string {
	return code === '23505' ? 'Ya existe una colección con ese slug.' : fallback;
}

/** Creates (id null) or updates a collection; returns the problem to show, or null. */
export async function saveCollection(
	db: Db,
	input: CollectionInput,
	id: string | null
): Promise<string | null> {
	const { error } = id
		? await db.from('collections').update(input).eq('id', id)
		: await db.from('collections').insert(input);
	return error
		? messageFor(error.code, 'No pudimos guardar la colección. Intenta de nuevo.')
		: null;
}

/** Products and gallery items let go of the collection (cascade / set null in the schema). */
export async function deleteCollection(db: Db, id: string): Promise<string | null> {
	const { error } = await db.from('collections').delete().eq('id', id);
	return error ? 'No pudimos eliminarla. Intenta de nuevo.' : null;
}
