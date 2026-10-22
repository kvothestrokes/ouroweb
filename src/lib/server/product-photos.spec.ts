import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_WIDTH, preparePhoto } from './product-photos.js';

async function image(width: number, height: number, format: 'jpeg' | 'png' | 'webp' | 'gif') {
	const bytes = await sharp({
		create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } }
	})
		.toFormat(format)
		.toBuffer();
	return new File([new Uint8Array(bytes)], `foto.${format}`);
}

describe('preparePhoto', () => {
	it('accepts JPEG, PNG and WebP photos and stores them as WebP', async () => {
		for (const format of ['jpeg', 'png', 'webp'] as const) {
			const result = await preparePhoto(await image(1200, 900, format));
			expect(result.ok).toBe(true);
			if (result.ok) expect((await sharp(result.bytes).metadata()).format).toBe('webp');
		}
	});

	it(`reduces photos wider than ${MAX_PHOTO_WIDTH} px`, async () => {
		const result = await preparePhoto(await image(4000, 3000, 'jpeg'));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const meta = await sharp(result.bytes).metadata();
		expect(meta.width).toBe(MAX_PHOTO_WIDTH);
		expect(meta.height).toBe(1500);
	});

	it('rejects other formats, tiny photos and empty files', async () => {
		expect(await preparePhoto(await image(1200, 900, 'gif'))).toEqual({
			ok: false,
			message: 'La foto debe ser JPG, PNG o WebP.'
		});
		expect(await preparePhoto(await image(300, 300, 'jpeg'))).toEqual({
			ok: false,
			message: 'La foto es muy pequeña: súbela de al menos 600 px de ancho.'
		});
		expect(await preparePhoto(new File([], 'vacia.jpg'))).toEqual({
			ok: false,
			message: 'La foto debe ser JPG, PNG o WebP.'
		});
	});
});
