import type { SupabaseClient } from '@supabase/supabase-js';
import { inFolder, orphanFiles, type StoredFile } from '#lib/domain/orphans.js';
import type { Database } from '#lib/types/database.js';
import { FOLDERS, deleteFileById, listFolderFiles } from './imagekit.js';

type Db = SupabaseClient<Database>;

/**
 * Files in the designs and products folders that no row references. Deletions right after an
 * upload can miss a file that ImageKit has not indexed yet; this sweep catches those later.
 * Throws when the references cannot be read: an incomplete list would mark used files as orphans.
 */
export async function findOrphans(db: Db, now = new Date()): Promise<StoredFile[]> {
	const [designs, images] = await Promise.all([
		readAll<{ path_prenda_oscura: string | null; path_prenda_clara: string | null }>(
			db,
			'designs',
			'path_prenda_oscura, path_prenda_clara'
		),
		readAll<{ imagekit_path: string }>(db, 'product_images', 'imagekit_path')
	]);

	const used = new Set<string>();
	for (const design of designs) {
		if (design.path_prenda_oscura) used.add(design.path_prenda_oscura);
		if (design.path_prenda_clara) used.add(design.path_prenda_clara);
	}
	for (const image of images) used.add(image.imagekit_path);

	const files = [
		...(await listFolderFiles('designs')).filter((file) =>
			inFolder(file.filePath, FOLDERS.designs)
		),
		...(await listFolderFiles('products')).filter((file) =>
			inFolder(file.filePath, FOLDERS.products)
		)
	];
	return orphanFiles(files, used, now);
}

const PAGE = 1000;

/**
 * Reads every row of a table. PostgREST silently caps responses (max_rows), so rows are paged
 * and the total is checked against an exact count: a short list must abort, never delete.
 */
async function readAll<Row>(
	db: Db,
	table: 'designs' | 'product_images',
	columns: string
): Promise<Row[]> {
	const rows: Row[] = [];
	let total: number | null = null;
	for (let from = 0; total === null || from < total; from += PAGE) {
		const { data, error, count } = await db
			.from(table)
			.select(columns, { count: 'exact' })
			.order('id')
			.range(from, from + PAGE - 1);
		if (error || count === null) throw new Error(`could not read ${table}`);
		total = count;
		rows.push(...(data as Row[]));
		if (data.length === 0) break;
	}
	if (rows.length !== total) throw new Error(`incomplete read of ${table}`);
	return rows;
}

/** Deletes the orphans found right now (re-checked, never from a stale list). */
export async function deleteOrphans(db: Db): Promise<{ deleted: number; failed: number }> {
	const orphans = await findOrphans(db);
	const results = await Promise.allSettled(orphans.map((file) => deleteFileById(file.fileId)));
	const failed = results.filter((result) => result.status === 'rejected').length;
	return { deleted: results.length - failed, failed };
}
