import { describe, expect, it } from 'vitest';
import { inFolder, orphanFiles } from './orphans.js';

const now = new Date('2026-10-22T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe('orphanFiles', () => {
	const files = [
		{ fileId: 'a', filePath: '/ouroboros/designs/usado.png', createdAt: minutesAgo(120) },
		{ fileId: 'b', filePath: '/ouroboros/designs/viejo.png', createdAt: minutesAgo(120) },
		{ fileId: 'c', filePath: '/ouroboros/designs/recien.png', createdAt: minutesAgo(2) },
		{ fileId: 'd', filePath: '/ouroboros/products/foto.webp', createdAt: minutesAgo(30) }
	];

	it('returns files nothing references that are older than the grace period', () => {
		const used = new Set(['/ouroboros/designs/usado.png']);
		expect(orphanFiles(files, used, now).map((file) => file.fileId)).toEqual(['b', 'd']);
	});

	it('never returns a referenced file or one still being uploaded', () => {
		const used = new Set(files.map((file) => file.filePath));
		expect(orphanFiles(files, used, now)).toEqual([]);
		expect(orphanFiles(files, new Set(), now).some((file) => file.fileId === 'c')).toBe(false);
	});

	it('skips entries without a valid creation date', () => {
		expect(
			orphanFiles(
				[{ fileId: 'x', filePath: '/ouroboros/designs/x.png', createdAt: 'no' }],
				new Set(),
				now
			)
		).toEqual([]);
	});
});

describe('inFolder', () => {
	it('keeps only files directly inside the folder', () => {
		expect(inFolder('/ouroboros/designs/a.png', '/ouroboros/designs')).toBe(true);
		expect(inFolder('/ouroboros/designs-old/a.png', '/ouroboros/designs')).toBe(false);
		expect(inFolder('/ouroboros/designs/sub/a.png', '/ouroboros/designs')).toBe(false);
		expect(inFolder('/ouroboros/products/a.webp', '/ouroboros/designs')).toBe(false);
	});
});
