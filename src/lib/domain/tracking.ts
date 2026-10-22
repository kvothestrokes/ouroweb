import type { FormResult } from './catalog.js';
import { cleanText } from './checkout.js';

const FOLIO = /^[A-Z]{2,5}-\d{4}-\d{4}$/;
const INVALID = 'Escribe tu folio (ej. OUR-2610-0042) y los últimos 4 dígitos de tu WhatsApp.';

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

/** Spec 6.5: folio plus the last 4 digits of the customer's WhatsApp. */
export function parseTracking(form: FormData): FormResult<{ folio: string; digitos: string }> {
	const folio = text(form, 'folio').toUpperCase();
	const digitos = text(form, 'digitos');
	if (!FOLIO.test(folio) || !/^\d{4}$/.test(digitos)) return { ok: false, message: INVALID };
	return { ok: true, value: { folio, digitos } };
}

export function reviewFromForm(
	form: FormData
): FormResult<{ calificacion: number; texto: string }> {
	const calificacion = Number(text(form, 'calificacion'));
	if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
		return { ok: false, message: 'Elige de 1 a 5 estrellas.' };
	}
	return {
		ok: true,
		value: { calificacion, texto: cleanText(text(form, 'texto'), true).slice(0, 600) }
	};
}
