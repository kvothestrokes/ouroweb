import type { FormResult } from './catalog.js';
import { parseMoney } from './money.js';

export type SizeGuide = Record<string, { ancho_cm: number; largo_cm: number }>;

export type GarmentTypeInput = {
	nombre: string;
	tallas: string[];
	/** Surcharge in cents per size; sizes without surcharge are left out. */
	recargos_talla: Record<string, number>;
	guia_tallas: SizeGuide;
	precio_normal: number | null;
	precio_mayoreo: number | null;
	mayoreo_cantidad_min: number | null;
};

const SIZE = /^[A-Z0-9]{1,5}$/;
const MAX_SIZES = 12;

function text(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Centimeters with at most one decimal, 1–200. */
function centimeters(value: string): number | null {
	if (!/^\d{1,3}(\.\d)?$/.test(value)) return null;
	const cm = Number(value);
	return cm >= 1 && cm <= 200 ? cm : null;
}

/**
 * Reads the garment type form. Size rows come as parallel `talla`, `recargo`, `ancho`
 * and `largo` fields, in display order.
 */
export function garmentTypeFromForm(form: FormData): FormResult<GarmentTypeInput> {
	const nombre = text(form.get('nombre'));
	if (!nombre || nombre.length > 40)
		return { ok: false, message: 'Escribe el nombre de la prenda.' };

	const sizes = form.getAll('talla').map(text);
	const surcharges = form.getAll('recargo').map(text);
	const widths = form.getAll('ancho').map(text);
	const lengths = form.getAll('largo').map(text);

	const tallas: string[] = [];
	const recargos_talla: Record<string, number> = {};
	const guia_tallas: SizeGuide = {};

	for (const [i, raw] of sizes.entries()) {
		if (!raw) continue;
		const talla = raw.toUpperCase();
		if (!SIZE.test(talla)) {
			return { ok: false, message: 'Las tallas usan letras o números cortos (ej. CH, M, XXG).' };
		}
		if (tallas.includes(talla)) return { ok: false, message: `La talla ${talla} está repetida.` };
		tallas.push(talla);

		const surcharge = parseMoney(surcharges[i] ?? '');
		if (Number.isNaN(surcharge))
			return { ok: false, message: `Revisa el recargo de la talla ${talla}.` };
		if (surcharge) recargos_talla[talla] = surcharge;

		const [ancho, largo] = [widths[i] ?? '', lengths[i] ?? ''];
		if (ancho || largo) {
			const [ancho_cm, largo_cm] = [centimeters(ancho), centimeters(largo)];
			if (ancho_cm === null || largo_cm === null) {
				return {
					ok: false,
					message: `Escribe ancho y largo de la talla ${talla} (o deja los dos vacíos).`
				};
			}
			guia_tallas[talla] = { ancho_cm, largo_cm };
		}
	}

	if (tallas.length === 0) return { ok: false, message: 'Agrega al menos una talla.' };
	if (tallas.length > MAX_SIZES) return { ok: false, message: `Máximo ${MAX_SIZES} tallas.` };

	const precio_normal = parseMoney(form.get('precio_normal'));
	if (Number.isNaN(precio_normal)) return { ok: false, message: 'Revisa el precio normal.' };
	const precio_mayoreo = parseMoney(form.get('precio_mayoreo'));
	if (Number.isNaN(precio_mayoreo)) return { ok: false, message: 'Revisa el precio de mayoreo.' };
	if (precio_normal !== null && precio_mayoreo !== null && precio_mayoreo > precio_normal) {
		return { ok: false, message: 'El precio de mayoreo no puede ser mayor al precio normal.' };
	}

	const minimum = text(form.get('mayoreo_cantidad_min'));
	let mayoreo_cantidad_min: number | null = null;
	if (minimum) {
		if (!/^\d{1,4}$/.test(minimum) || Number(minimum) < 2) {
			return { ok: false, message: 'El mayoreo aplica desde 2 piezas o más.' };
		}
		mayoreo_cantidad_min = Number(minimum);
	}

	return {
		ok: true,
		value: {
			nombre,
			tallas,
			recargos_talla,
			guia_tallas,
			precio_normal,
			precio_mayoreo,
			mayoreo_cantidad_min
		}
	};
}
