import { describe, expect, it } from 'vitest';
import { parseTracking, reviewFromForm } from './tracking.js';

function form(fields: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('parseTracking', () => {
	it('normalizes the folio and reads the last 4 digits', () => {
		expect(parseTracking(form({ folio: ' our-2610-0042 ', digitos: '3984' }))).toEqual({
			ok: true,
			value: { folio: 'OUR-2610-0042', digitos: '3984' }
		});
	});

	it('rejects a malformed folio or digits', () => {
		const message = 'Escribe tu folio (ej. OUR-2610-0042) y los últimos 4 dígitos de tu WhatsApp.';
		expect(parseTracking(form({ folio: 'OUR-26-1', digitos: '3984' }))).toEqual({
			ok: false,
			message
		});
		expect(parseTracking(form({ folio: 'OUR-2610-0042', digitos: '39a4' }))).toEqual({
			ok: false,
			message
		});
	});
});

describe('reviewFromForm', () => {
	it('reads the rating and a cleaned text', () => {
		expect(reviewFromForm(form({ calificacion: '5', texto: ' ¡Me encantó!‮ ' }))).toEqual({
			ok: true,
			value: { calificacion: 5, texto: '¡Me encantó!' }
		});
	});

	it('requires a rating from 1 to 5', () => {
		expect(reviewFromForm(form({ calificacion: '0' }))).toEqual({
			ok: false,
			message: 'Elige de 1 a 5 estrellas.'
		});
	});
});
