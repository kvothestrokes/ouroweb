import sharp from 'sharp';

/** Width/height ratio of the sample design, used to draw the print area box in the editor. */
export const SAMPLE_DESIGN_RATIO = 4 / 3;

let cached: Promise<Buffer> | undefined;

/**
 * Stand-in design for previewing a print area before real designs exist:
 * a transparent PNG with the brand ring and name.
 */
export function sampleDesign(): Promise<Buffer> {
	cached ??= sharp(
		Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
				<circle cx="400" cy="250" r="200" fill="none" stroke="#d4af37" stroke-width="36"/>
				<text x="400" y="290" font-size="120" text-anchor="middle" font-family="Georgia, serif" fill="#7c3aed">OURO</text>
				<text x="400" y="560" font-size="90" text-anchor="middle" font-family="Georgia, serif" fill="#d4af37">BOROS</text>
			</svg>`
		)
	)
		.png()
		.toBuffer();
	return cached;
}
