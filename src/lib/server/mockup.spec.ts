import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { composeMockup, watermarkPhoto } from './mockup.js';

type Rgb = [number, number, number];

const RED: Rgb = [220, 30, 30];
const BLUE: Rgb = [20, 40, 220];
const WHITE: Rgb = [255, 255, 255];

function solid(width: number, height: number, [r, g, b]: Rgb): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: { r, g, b } } })
		.png()
		.toBuffer();
}

async function pixel(image: Buffer, x: number, y: number): Promise<Rgb> {
	const { data, info } = await sharp(image)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const i = (y * info.width + x) * info.channels;
	return [data[i], data[i + 1], data[i + 2]];
}

function near(actual: Rgb, expected: Rgb, tolerance = 40): boolean {
	return actual.every((value, i) => Math.abs(value - expected[i]) <= tolerance);
}

describe('composeMockup', () => {
	it('places the design inside the print area and leaves the rest of the base untouched', async () => {
		const out = await composeMockup({
			base: await solid(400, 400, RED),
			design: await solid(100, 100, BLUE),
			area: { x: 100, y: 100, ancho: 200 },
			maxSize: 400
		});
		expect(near(await pixel(out, 200, 200), BLUE)).toBe(true);
		expect(near(await pixel(out, 20, 20), RED)).toBe(true);
		expect(near(await pixel(out, 330, 200), RED)).toBe(true);
	});

	it('keeps the design aspect ratio at the print area width', async () => {
		const out = await composeMockup({
			base: await solid(400, 400, RED),
			design: await solid(100, 50, BLUE),
			area: { x: 100, y: 100, ancho: 200 },
			maxSize: 400
		});
		// 200 × 100 design: covers y 100–200, the base shows again below it.
		expect(near(await pixel(out, 200, 150), BLUE)).toBe(true);
		expect(near(await pixel(out, 200, 260), RED)).toBe(true);
	});

	it('outputs WebP no larger than maxSize, keeping the base proportions', async () => {
		const out = await composeMockup({
			base: await solid(2048, 1024, RED),
			design: await solid(100, 100, BLUE),
			area: { x: 800, y: 300, ancho: 400 }
		});
		const meta = await sharp(out).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.width).toBe(1000);
		expect(meta.height).toBe(500);
	});

	it('crops a design that would overflow the bottom of the base instead of failing', async () => {
		const out = await composeMockup({
			base: await solid(400, 400, RED),
			design: await solid(100, 100, BLUE),
			area: { x: 100, y: 300, ancho: 200 },
			maxSize: 400
		});
		expect(near(await pixel(out, 200, 350), BLUE)).toBe(true);
	});

	it('rejects a print area outside the base', async () => {
		const base = await solid(400, 400, RED);
		const design = await solid(100, 100, BLUE);
		await expect(composeMockup({ base, design, area: { x: 0, y: 0, ancho: 0 } })).rejects.toThrow(
			/print area/
		);
		await expect(
			composeMockup({ base, design, area: { x: 300, y: 0, ancho: 200 } })
		).rejects.toThrow(/print area/);
	});

	it('stamps the watermark on the garment, centered just below the design', async () => {
		const base = await solid(400, 400, RED);
		const design = await solid(100, 100, BLUE);
		const area = { x: 100, y: 100, ancho: 200 };
		const plain = await composeMockup({ base, design, area, maxSize: 400 });
		const marked = await composeMockup({
			base,
			design,
			area,
			maxSize: 400,
			watermark: await solid(200, 200, WHITE)
		});
		// Design covers y 100–300; the 40 px watermark sits at x 180–220, y 310–350.
		expect(near(await pixel(plain, 200, 342), RED)).toBe(true);
		expect(near(await pixel(marked, 200, 342), RED, 15)).toBe(false);
		expect(near(await pixel(marked, 200, 200), BLUE)).toBe(true);
		expect(near(await pixel(marked, 360, 360), RED)).toBe(true);
	});

	it('keeps the watermark inside the base when the design reaches the bottom', async () => {
		const out = await composeMockup({
			base: await solid(400, 400, RED),
			design: await solid(100, 100, BLUE),
			area: { x: 100, y: 200, ancho: 200 },
			maxSize: 400,
			watermark: await solid(200, 200, WHITE)
		});
		expect((await sharp(out).metadata()).height).toBe(400);
	});
});

describe('watermarkPhoto', () => {
	it('resizes a photo to maxSize as WebP and stamps the watermark near the bottom', async () => {
		const plainPhoto = await solid(2000, 1500, RED);
		const out = await watermarkPhoto({
			photo: plainPhoto,
			watermark: await solid(200, 200, WHITE),
			maxSize: 800
		});
		const meta = await sharp(out).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.width).toBe(800);
		expect(meta.height).toBe(600);
		// 10% of 2000 px = 200 px mark, bottom-right with a 50 px margin → scaled ×0.4.
		expect(near(await pixel(out, 800 - 20 - 40, 600 - 20 - 40), RED, 15)).toBe(false);
		expect(near(await pixel(out, 100, 100), RED)).toBe(true);
	});
});
