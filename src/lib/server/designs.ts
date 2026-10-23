import type { SupabaseClient } from '@supabase/supabase-js';
import { designPathFor, type DesignFiles } from '#lib/domain/design-variant.js';
import { DEFAULT_PRINT_AREA, parsePrintArea } from '#lib/domain/print-area.js';
import type { Database } from '#lib/types/database.js';
import { prepareDesign } from './design-files.js';
import { loadBase, loadWatermarkSource, parseFotoKey } from './garment-assets.js';
import { downloadImage, uploadImage } from './imagekit.js';
import { composeMockup } from './mockup.js';

type Db = SupabaseClient<Database>;

export type DesignRow = DesignFiles & { id: string; nombre: string };

export async function listDesigns(db: Db): Promise<DesignRow[] | null> {
	const { data, error } = await db
		.from('designs')
		.select('id, nombre, path_prenda_oscura, path_prenda_clara')
		.order('created_at', { ascending: false });
	return error ? null : data;
}

export type StoredFile = { ok: true; path: string } | { ok: false; message: string };

/** Validates and uploads one design version to the private `designs` folder. */
export async function storeDesignFile(file: File): Promise<StoredFile> {
	const prepared = await prepareDesign(file);
	if (!prepared.ok) return prepared;
	try {
		const path = await uploadImage(
			new File([new Uint8Array(prepared.png)], 'diseno.png', { type: 'image/png' }),
			'designs'
		);
		return { ok: true, path };
	} catch {
		return { ok: false, message: 'No pudimos subir el diseño. Intenta de nuevo.' };
	}
}

/** A file input counts only when something was picked. */
export function pickedFile(value: FormDataEntryValue | null): File | null {
	return value instanceof File && value.size > 0 ? value : null;
}

// Designs are fetched from ImageKit once and reused for a while: a preview grid asks for
// the same design once per garment color.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 30;
const cache = new Map<string, { at: number; bytes: Promise<Buffer> }>();

export function loadDesign(path: string): Promise<Buffer> {
	const hit = cache.get(path);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.bytes;

	const bytes = downloadImage(path);
	cache.set(path, { at: Date.now(), bytes });
	bytes.catch(() => cache.delete(path));
	if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
	return bytes;
}

export type MockupBase = { foto: string; es_clara: boolean; area_impresion: unknown };

/** Mockup of a design on a garment base, or null when the photo or the design file is missing. */
export async function renderDesignMockup(
	design: DesignFiles,
	base: MockupBase,
	{ maxSize, watermark = true }: { maxSize: number; watermark?: boolean }
): Promise<Buffer | null> {
	const key = parseFotoKey(base.foto);
	const photo = key ? await loadBase(key.tipo, key.color) : null;
	const path = designPathFor(design, base.es_clara);
	if (!photo || !path) return null;

	return composeMockup({
		base: photo,
		design: await loadDesign(path),
		area: parsePrintArea(base.area_impresion) ?? DEFAULT_PRINT_AREA,
		watermark: watermark ? await loadWatermarkSource() : undefined,
		maxSize
	});
}
