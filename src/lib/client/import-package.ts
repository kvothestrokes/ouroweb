import { unzip, type UnzipFileInfo } from 'fflate';
import type { FormResult } from '#lib/domain/catalog.js';
import { MAX_DESIGN_WIDTH, MAX_PHOTO_WIDTH } from '#lib/domain/design-variant.js';
import { normalizeFileName } from '#lib/domain/product-import.js';

/** Browser side of the bulk import: reads the uploaded package and keeps requests small. */

export type ImportPackage = { csv: string; images: Map<string, File> };

const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp'
};

/** Guards against zip bombs and accidental huge uploads before anything is inflated. */
const MAX_ENTRIES = 2000;
const MAX_TOTAL_BYTES = 600 * 1024 * 1024;
const MAX_FILE_BYTES = 40 * 1024 * 1024;

function baseName(path: string): string {
	return normalizeFileName(path);
}

function extension(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** macOS metadata (`__MACOSX/`, `._x`, `.DS_Store`) and folders are not part of the package. */
function isNoise(path: string): boolean {
	const normalized = path.replace(/\\/g, '/');
	const name = baseName(normalized);
	return normalized.endsWith('/') || normalized.startsWith('__MACOSX/') || name.startsWith('.');
}

function decodeCsv(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
	} catch {
		// Excel's plain "CSV" format on Windows is not UTF-8.
		return new TextDecoder('windows-1252').decode(bytes);
	}
}

function unzipAsync(
	data: Uint8Array,
	filter: (file: UnzipFileInfo) => boolean
): Promise<Record<string, Uint8Array>> {
	return new Promise((resolve, reject) =>
		unzip(data, { filter }, (error, result) => (error ? reject(error) : resolve(result)))
	);
}

/**
 * Accepts either one ZIP (`productos.csv` + images in any folder) or one CSV with loose image
 * files. Images are indexed by file name, which is what the CSV references.
 */
export async function readImportPackage(selected: File[]): Promise<FormResult<ImportPackage>> {
	const entries: { name: string; bytes: Blob | Uint8Array }[] = [];

	const zips = selected.filter((file) => extension(file.name) === 'zip');
	if (zips.length > 1) return { ok: false, message: 'Sube un solo ZIP por carga.' };
	if (zips.length === 1) {
		if (selected.length > 1) {
			return { ok: false, message: 'Sube el ZIP solo, sin otros archivos.' };
		}
		let count = 0;
		let total = 0;
		let tooBig = false;
		let unpacked: Record<string, Uint8Array>;
		try {
			unpacked = await unzipAsync(new Uint8Array(await zips[0].arrayBuffer()), (file) => {
				if (isNoise(file.name)) return false;
				const kind = extension(file.name);
				if (kind !== 'csv' && !IMAGE_TYPES[kind]) return false;
				count++;
				total += file.originalSize;
				if (count > MAX_ENTRIES || total > MAX_TOTAL_BYTES || file.originalSize > MAX_FILE_BYTES) {
					tooBig = true;
				}
				return !tooBig;
			});
		} catch {
			return { ok: false, message: 'No pudimos abrir el ZIP: revisa que no esté dañado.' };
		}
		if (tooBig) {
			return {
				ok: false,
				message: 'El ZIP es demasiado grande (máximo 2000 archivos, 600 MB y 40 MB por imagen).'
			};
		}
		for (const [path, bytes] of Object.entries(unpacked)) entries.push({ name: path, bytes });
	} else {
		for (const file of selected) entries.push({ name: file.name, bytes: file });
	}

	const csvEntries = entries.filter((entry) => extension(entry.name) === 'csv');
	if (csvEntries.length !== 1) {
		return {
			ok: false,
			message:
				csvEntries.length === 0
					? 'Falta el archivo CSV con los productos.'
					: 'Hay más de un CSV: deja solo productos.csv.'
		};
	}
	const csvBytes = csvEntries[0].bytes;
	const csv = decodeCsv(
		csvBytes instanceof Uint8Array ? csvBytes : new Uint8Array(await csvBytes.arrayBuffer())
	);

	const images = new Map<string, File>();
	for (const entry of entries) {
		const name = baseName(entry.name);
		const type = IMAGE_TYPES[extension(name)];
		if (!type || isNoise(entry.name)) continue;
		if (images.has(name)) {
			return { ok: false, message: `Hay dos imágenes llamadas «${name}»: renombra una.` };
		}
		const bytes = entry.bytes instanceof Uint8Array ? new Uint8Array(entry.bytes) : entry.bytes;
		images.set(name, new File([bytes], name, { type }));
	}
	return { ok: true, value: { csv, images } };
}

/**
 * Vercel functions reject request bodies over 4.5 MB, so each row must fit in one request.
 * When a row's images exceed the budget they are downscaled to the size the server keeps anyway
 * (designs as PNG to preserve transparency, photos as WebP). Returns null when they still do not fit.
 */
export async function fitToBudget(
	designs: File[],
	photos: File[],
	budget = 4 * 1024 * 1024
): Promise<{ designs: File[]; photos: File[] } | null> {
	const size = (files: File[]) => files.reduce((sum, file) => sum + file.size, 0);
	if (size(designs) + size(photos) <= budget) return { designs, photos };

	const shrunk = {
		designs: await Promise.all(
			designs.map((file) => reencode(file, MAX_DESIGN_WIDTH, 'image/png'))
		),
		photos: await Promise.all(photos.map((file) => reencode(file, MAX_PHOTO_WIDTH, 'image/webp')))
	};
	return size(shrunk.designs) + size(shrunk.photos) <= budget ? shrunk : null;
}

async function reencode(file: File, maxWidth: number, type: string): Promise<File> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file; // let the server report the invalid image
	}
	const scale = Math.min(1, maxWidth / bitmap.width);
	const canvas = new OffscreenCanvas(
		Math.round(bitmap.width * scale),
		Math.round(bitmap.height * scale)
	);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	const blob = await canvas.convertToBlob({ type, quality: 0.9 });
	// Keep the original name: the server matches files to CSV references by name.
	return blob.size < file.size ? new File([blob], file.name, { type }) : file;
}
