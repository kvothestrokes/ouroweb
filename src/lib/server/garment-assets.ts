/**
 * Base garment photos and the watermark source, bundled into the server only.
 *
 * They live under `src/lib/server/assets/` (not `static/`, which is fully public) and are
 * imported with `?inline`, so Vite embeds them in the server bundle and never emits them
 * as client assets: the browser only ever receives composed mockups (see `mockup.ts`).
 * File layout: `assets/bases/<garment-type>/<color>.jpg`; the file name is the color.
 */

const bases = import.meta.glob<string>('./assets/bases/*/*.jpg', {
	query: '?inline',
	import: 'default'
});

const watermark = import.meta.glob<string>('./assets/brand/watermark-source.webp', {
	query: '?inline',
	import: 'default'
});

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function baseKey(tipo: string, color: string): string {
	return `./assets/bases/${tipo}/${color}.jpg`;
}

function fromDataUrl(dataUrl: string): Buffer {
	return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/** Colors available for a garment type, from the file names, sorted. */
export function baseColors(tipo: string): string[] {
	if (!SLUG.test(tipo)) return [];
	const prefix = `./assets/bases/${tipo}/`;
	return Object.keys(bases)
		.filter((key) => key.startsWith(prefix))
		.map((key) => key.slice(prefix.length, -'.jpg'.length))
		.sort();
}

/** JPEG bytes of a base photo, or null when the type or color does not exist. */
export async function loadBase(tipo: string, color: string): Promise<Buffer | null> {
	if (!SLUG.test(tipo) || !SLUG.test(color)) return null;
	const load = bases[baseKey(tipo, color)];
	return load ? fromDataUrl(await load()) : null;
}

/** Logo used to build the mockup watermark. */
export async function loadWatermarkSource(): Promise<Buffer> {
	const load = Object.values(watermark)[0];
	if (!load) throw new Error('watermark source is missing');
	return fromDataUrl(await load());
}
