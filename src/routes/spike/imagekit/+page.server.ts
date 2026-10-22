// TEMPORARY Fase 0 spike: validates private design overlays inside signed URLs
// and fixed-expiry caching (spec §5, §12). Dev only; delete after the spike.
import { error, fail } from '@sveltejs/kit';
import { dev } from '$app/env';
import { mockupUrl, signedImageUrl, uploadImage } from '#lib/server/imagekit.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_BYTES = 10 * 1024 * 1024;

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
};

async function probe(url: string) {
	const response = await fetch(url, { method: 'GET' });
	return {
		status: response.status,
		contentType: response.headers.get('content-type'),
		cacheControl: response.headers.get('cache-control'),
		cdnCache: response.headers.get('x-cache') ?? response.headers.get('cf-cache-status')
	};
}

function readFile(data: FormData, name: string): File | null {
	const value = data.get(name);
	if (!(value instanceof File) || value.size === 0) return null;
	return value;
}

function readPath(data: FormData, name: string): string | null {
	const value = String(data.get(name) ?? '').trim();
	return value.startsWith('/ouroboros/') ? value : null;
}

export const actions = {
	default: async ({ request }) => {
		if (!dev) error(404, 'Not found');
		const data = await request.formData();

		const files = {
			base: readFile(data, 'base'),
			design: readFile(data, 'design'),
			watermark: readFile(data, 'watermark')
		};
		for (const file of Object.values(files)) {
			if (file && (!file.type.startsWith('image/') || file.size > MAX_BYTES)) {
				return fail(400, { message: 'Solo imágenes de hasta 10 MB.' });
			}
		}

		try {
			const basePath = files.base
				? await uploadImage(files.base, 'bases')
				: readPath(data, 'basePath');
			const designPath = files.design
				? await uploadImage(files.design, 'designs')
				: readPath(data, 'designPath');
			const watermarkPath = files.watermark
				? await uploadImage(files.watermark, 'brand')
				: readPath(data, 'watermarkPath');

			if (!basePath || !designPath || !watermarkPath) {
				return fail(400, { message: 'Falta la prenda base, el diseño o la marca de agua.' });
			}

			const printArea = {
				x: Number(data.get('x')) || 0,
				y: Number(data.get('y')) || 0,
				width: Number(data.get('width')) || 600
			};
			const mockups = [400, 800].map((outputWidth) =>
				mockupUrl({ basePath, designPath, watermarkPath, printArea, outputWidth })
			);
			const designSigned = signedImageUrl(designPath);
			const designUnsigned = designSigned.replace(/[?&]ik-t=.*$/, '');

			return {
				paths: { basePath, designPath, watermarkPath },
				printArea,
				mockups,
				probes: {
					mockup: await probe(mockups[1]),
					mockupAgain: await probe(mockups[1]),
					designSigned: await probe(designSigned),
					designUnsigned: await probe(designUnsigned)
				}
			};
		} catch (cause) {
			console.error('[spike/imagekit]', cause);
			return fail(500, {
				message: 'ImageKit rechazó la operación; revisa la consola del servidor.'
			});
		}
	}
} satisfies Actions;
