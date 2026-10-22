import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_DESIGN_WIDTH, prepareDesign } from './design-files.js';

async function png(width: number, height: number, { transparent = true } = {}): Promise<File> {
	const bytes = await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 200, g: 20, b: 20, alpha: transparent ? 0 : 1 }
		}
	})
		// A visible square so the design is not fully transparent.
		.composite([
			{
				input: await sharp({
					create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
				})
					.png()
					.toBuffer(),
				left: 0,
				top: 0
			}
		])
		.png()
		.toBuffer();
	return new File([new Uint8Array(bytes)], 'diseno.png', { type: 'image/png' });
}

describe('prepareDesign', () => {
	it('accepts a transparent PNG and keeps it as PNG', async () => {
		const result = await prepareDesign(await png(800, 600));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const meta = await sharp(result.png).metadata();
		expect(meta.format).toBe('png');
		expect(meta.hasAlpha).toBe(true);
		expect(meta.width).toBe(800);
	});

	it(`reduces designs wider than ${MAX_DESIGN_WIDTH} px, keeping the proportions`, async () => {
		const result = await prepareDesign(await png(3200, 2400));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const meta = await sharp(result.png).metadata();
		expect(meta.width).toBe(MAX_DESIGN_WIDTH);
		expect(meta.height).toBe(1200);
	});

	it('rejects files that are not PNG', async () => {
		const jpeg = await sharp({
			create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } }
		})
			.jpeg()
			.toBuffer();
		const result = await prepareDesign(new File([new Uint8Array(jpeg)], 'x.jpg'));
		expect(result).toEqual({
			ok: false,
			message: 'El diseño debe ser un PNG con fondo transparente.'
		});
	});

	it('rejects a PNG without transparency', async () => {
		expect(await prepareDesign(await png(800, 600, { transparent: false }))).toEqual({
			ok: false,
			message: 'El PNG no tiene fondo transparente.'
		});
	});

	it('rejects designs that are too small to look good', async () => {
		expect(await prepareDesign(await png(200, 200))).toEqual({
			ok: false,
			message: 'El diseño es muy pequeño: súbelo de al menos 400 px de ancho.'
		});
	});

	it('rejects an empty file', async () => {
		expect(await prepareDesign(new File([], 'vacio.png'))).toEqual({
			ok: false,
			message: 'El diseño debe ser un PNG con fondo transparente.'
		});
	});
});
