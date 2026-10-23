import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareReference } from './reference-images.js';

async function png(width: number, height: number) {
	const bytes = await sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 20, b: 20 } }
	})
		.png()
		.withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
		.toBuffer();
	return new File([new Uint8Array(bytes)], 'ref.png', { type: 'image/png' });
}

describe('prepareReference', () => {
	it('re-encodes to WebP within 1600 px and drops metadata', async () => {
		const result = await prepareReference(await png(2400, 1200));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const meta = await sharp(result.bytes).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.width).toBe(1600);
		expect(meta.exif).toBeUndefined();
	});

	it('rejects files that are not images', async () => {
		const fake = new File(['<svg onload=alert(1)>'], 'x.png', { type: 'image/png' });
		expect(await prepareReference(fake)).toEqual({
			ok: false,
			message: 'Las imágenes de referencia deben ser JPG, PNG o WebP.'
		});
	});
});
