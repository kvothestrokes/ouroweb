import { z } from 'zod';

/** Print area in pixels of the real base photo; the design height follows its own ratio. */
export type PrintArea = { x: number; y: number; ancho: number };

export type PhotoSize = { width: number; height: number };

/** Narrowest print area the editor accepts, in photo pixels. */
export const MIN_PRINT_WIDTH = 50;

/**
 * Starting area for new playera bases: all supplier photos share the same 2048 px framing,
 * so this lands on the chest. The admin adjusts it in the editor.
 */
export const DEFAULT_PRINT_AREA: PrintArea = { x: 724, y: 560, ancho: 600 };

const stored = z.object({ x: z.int(), y: z.int(), ancho: z.int() });

/** Reads `garment_bases.area_impresion`; null when it is not a valid area. */
export function parsePrintArea(value: unknown): PrintArea | null {
	const parsed = stored.safeParse(value);
	return parsed.success ? { x: parsed.data.x, y: parsed.data.y, ancho: parsed.data.ancho } : null;
}

const fromForm = z.object({
	x: z.coerce.number().int().min(0),
	y: z.coerce.number().int().min(0),
	ancho: z.coerce.number().int().min(MIN_PRINT_WIDTH)
});

export type PrintAreaResult = { ok: true; area: PrintArea } | { ok: false; message: string };

/** Validates the editor fields against the real photo size. */
export function printAreaFromForm(form: FormData, photo: PhotoSize): PrintAreaResult {
	const raw = { x: form.get('x'), y: form.get('y'), ancho: form.get('ancho') };
	// z.coerce turns "" into 0, so empty fields are rejected explicitly.
	if (Object.values(raw).some((value) => typeof value !== 'string' || value.trim() === '')) {
		return { ok: false, message: 'Revisa los valores del área de impresión.' };
	}
	const parsed = fromForm.safeParse(raw);
	if (!parsed.success) return { ok: false, message: 'Revisa los valores del área de impresión.' };

	const { x, y, ancho } = parsed.data;
	if (x >= photo.width || y >= photo.height) {
		return { ok: false, message: 'El área empieza fuera de la foto.' };
	}
	if (x + ancho > photo.width) {
		return { ok: false, message: 'El área se sale de la foto por la derecha.' };
	}
	return { ok: true, area: { x, y, ancho } };
}
