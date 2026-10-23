export type StoredFile = { fileId: string; filePath: string; createdAt: string };

/** Files younger than this may belong to an upload whose database row is still being written. */
export const ORPHAN_GRACE_MS = 10 * 60 * 1000;

/** Stored files that no database row references and that are past the grace period. */
export function orphanFiles(
	files: StoredFile[],
	used: ReadonlySet<string>,
	now: Date,
	graceMs = ORPHAN_GRACE_MS
): StoredFile[] {
	return files.filter((file) => {
		const created = Date.parse(file.createdAt);
		return !Number.isNaN(created) && now.getTime() - created > graceMs && !used.has(file.filePath);
	});
}

/** True when the file sits directly in `folder` (not in a subfolder or a look-alike folder). */
export function inFolder(filePath: string, folder: string): boolean {
	const prefix = `${folder}/`;
	return filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/');
}
