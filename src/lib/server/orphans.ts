import type { SupabaseClient } from '@supabase/supabase-js';
import { orphanFiles, type StoredFile } from '#lib/domain/orphans.js';
import type { Database } from '#lib/types/database.js';
import { deleteFileById, listFolderFiles } from './imagekit.js';

type Db = SupabaseClient<Database>;

/**
 * Files in the designs and products folders that no row references. Deletions right after an
 * upload can miss a file that ImageKit has not indexed yet; this sweep catches those later.
 * Throws when the references cannot be read: an incomplete list would mark used files as orphans.
 */
export async function findOrphans(db: Db, now = new Date()): Promise<StoredFile[]> {
	const [designs, images] = await Promise.all([
		db.from('designs').select('path_prenda_oscura, path_prenda_clara'),
		db.from('product_images').select('imagekit_path')
	]);
	if (designs.error || images.error) throw new Error('could not read file references');

	const used = new Set<string>();
	for (const design of designs.data) {
		if (design.path_prenda_oscura) used.add(design.path_prenda_oscura);
		if (design.path_prenda_clara) used.add(design.path_prenda_clara);
	}
	for (const image of images.data) used.add(image.imagekit_path);

	const files = [...(await listFolderFiles('designs')), ...(await listFolderFiles('products'))];
	return orphanFiles(files, used, now);
}

/** Deletes the orphans found right now (re-checked, never from a stale list). */
export async function deleteOrphans(db: Db): Promise<{ deleted: number; failed: number }> {
	const orphans = await findOrphans(db);
	const results = await Promise.allSettled(orphans.map((file) => deleteFileById(file.fileId)));
	const failed = results.filter((result) => result.status === 'rejected').length;
	return { deleted: results.length - failed, failed };
}
