import ImageKit, { toFile } from '@imagekit/nodejs';
import type { Transformation } from '@imagekit/nodejs/resources/shared';
import { IMAGEKIT_PRIVATE_KEY } from '$app/env/private';
import { PUBLIC_IMAGEKIT_URL_ENDPOINT } from '$app/env/public';
import { fixedExpiry, signUrl } from './imagekit-signing.js';

/** Root folders in ImageKit (spec §5.1). `designs` and `orders` are private. */
export const FOLDERS = {
	bases: '/ouroboros/bases',
	designs: '/ouroboros/designs',
	products: '/ouroboros/products',
	brand: '/ouroboros/brand',
	orders: '/ouroboros/orders',
	gallery: '/ouroboros/gallery'
} as const;

export type Folder = keyof typeof FOLDERS;

// Product photos are private too: the store only serves them watermarked through /img/f.
const PRIVATE_FOLDERS: ReadonlySet<Folder> = new Set(['designs', 'orders', 'products']);

const client = new ImageKit({ privateKey: IMAGEKIT_PRIVATE_KEY });

/**
 * Builds a signed delivery URL with a fixed per-period expiry, so the URL is
 * stable for the whole period and cacheable.
 */
export function signedImageUrl(path: string, transformation: Transformation[] = []): string {
	const unsigned = client.helper.buildSrc({
		urlEndpoint: PUBLIC_IMAGEKIT_URL_ENDPOINT,
		src: path,
		transformation
	});
	return signUrl(unsigned, {
		urlEndpoint: PUBLIC_IMAGEKIT_URL_ENDPOINT,
		privateKey: IMAGEKIT_PRIVATE_KEY,
		expiry: fixedExpiry()
	});
}

export interface PrintArea {
	x: number;
	y: number;
	width: number;
}

export interface MockupOptions {
	basePath: string;
	designPath: string;
	printArea: PrintArea;
	watermarkPath: string;
	/** Served width in px; capped at 1200 (spec §5.3). */
	outputWidth: number;
}

/**
 * Signed mockup URL: plain garment base + private design overlaid on the print
 * area + watermark, resized and compressed. The design path only lives inside
 * the signed transformation, never as a standalone URL.
 */
export function mockupUrl(options: MockupOptions): string {
	const { basePath, designPath, printArea, watermarkPath } = options;
	return signedImageUrl(basePath, [
		{
			overlay: {
				type: 'image',
				input: designPath,
				position: { x: printArea.x, y: printArea.y },
				transformation: [{ width: printArea.width }]
			}
		},
		{
			overlay: {
				type: 'image',
				input: watermarkPath,
				position: { focus: 'bottom_right' },
				transformation: [{ width: 'bw_div_4' }]
			}
		},
		{ width: Math.min(options.outputWidth, 1200), quality: 80, format: 'auto' }
	]);
}

/**
 * Uploads a file from the server into one of the known folders. Files in
 * private folders are only reachable through signed URLs. Returns the stored
 * `filePath`, which is what the database keeps (never the full URL).
 */
export async function uploadImage(file: File, folder: Folder): Promise<string> {
	const result = await client.files.upload({
		file: await toFile(file, file.name),
		fileName: file.name,
		folder: FOLDERS[folder],
		useUniqueFileName: true,
		isPrivateFile: PRIVATE_FOLDERS.has(folder)
	});
	if (!result.filePath) throw new Error('ImageKit upload returned no filePath');
	return result.filePath;
}

/** Parameters for a direct browser → ImageKit upload (admin panel, Fase 2). */
export function uploadAuthParams() {
	return client.helper.getAuthenticationParameters();
}

/** Downloads a stored image (private ones too) into the server; never sent to the browser as is. */
export async function downloadImage(path: string): Promise<Buffer> {
	const response = await fetch(signedImageUrl(path));
	if (!response.ok) throw new Error(`ImageKit download failed (${response.status}) for ${path}`);
	return Buffer.from(await response.arrayBuffer());
}

/**
 * Best-effort removal of a stored file by its `filePath` (the database keeps paths, not
 * file ids). Names are unique (`useUniqueFileName`), so folder + name finds exactly one file.
 * Returns false when nothing was deleted; callers must not fail the user action on it.
 */
export async function deleteImageByPath(path: string): Promise<boolean> {
	const slash = path.lastIndexOf('/');
	const folder = path.slice(0, slash) || '/';
	const name = path.slice(slash + 1);
	if (!name || /["\\\n\r]/.test(name)) return false;
	try {
		const assets = await client.assets.list({
			path: folder,
			type: 'file',
			searchQuery: `name = "${name}"`
		});
		const match = assets.find((asset) => 'filePath' in asset && asset.filePath === path);
		if (!match || !('fileId' in match) || !match.fileId) return false;
		await client.files.delete(match.fileId);
		return true;
	} catch {
		return false;
	}
}

/** Every file in one of the known folders (paginated listing of the ImageKit media library). */
export async function listFolderFiles(
	folder: Folder
): Promise<{ fileId: string; filePath: string; createdAt: string }[]> {
	const files: { fileId: string; filePath: string; createdAt: string }[] = [];
	const limit = 100;
	for (let skip = 0; ; skip += limit) {
		const page = await client.assets.list({ path: FOLDERS[folder], type: 'file', limit, skip });
		for (const asset of page) {
			if ('fileId' in asset && asset.fileId && asset.filePath && asset.createdAt) {
				files.push({ fileId: asset.fileId, filePath: asset.filePath, createdAt: asset.createdAt });
			}
		}
		if (page.length < limit) return files;
	}
}

export async function deleteFileById(fileId: string): Promise<void> {
	await client.files.delete(fileId);
}
