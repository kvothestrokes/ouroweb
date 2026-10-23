import { describe, expect, it } from 'vitest';
import { parsePrintArea, printAreaFromForm } from './print-area.js';

const bounds = { width: 2048, height: 2048 };

describe('parsePrintArea', () => {
	it('reads a stored area', () => {
		expect(parsePrintArea({ x: 724, y: 560, ancho: 600 })).toEqual({ x: 724, y: 560, ancho: 600 });
	});

	it('returns null for anything that is not an area', () => {
		expect(parsePrintArea(null)).toBeNull();
		expect(parsePrintArea({ x: 1, y: 2 })).toBeNull();
		expect(parsePrintArea({ x: '1', y: 2, ancho: 3 })).toBeNull();
		expect(parsePrintArea({ x: 1.5, y: 2, ancho: 3 })).toBeNull();
	});
});

describe('printAreaFromForm', () => {
	function form(values: Record<string, string>): FormData {
		const data = new FormData();
		for (const [key, value] of Object.entries(values)) data.set(key, value);
		return data;
	}

	it('accepts an area inside the photo', () => {
		expect(printAreaFromForm(form({ x: '724', y: '560', ancho: '600' }), bounds)).toEqual({
			ok: true,
			area: { x: 724, y: 560, ancho: 600 }
		});
	});

	it('rejects an area that leaves the photo, with a message for the admin', () => {
		const result = printAreaFromForm(form({ x: '1600', y: '560', ancho: '600' }), bounds);
		expect(result).toEqual({ ok: false, message: 'El área se sale de la foto por la derecha.' });
		expect(printAreaFromForm(form({ x: '0', y: '2048', ancho: '600' }), bounds)).toEqual({
			ok: false,
			message: 'El área empieza fuera de la foto.'
		});
	});

	it('rejects missing, negative, fractional or too small values', () => {
		const invalid = { ok: false, message: 'Revisa los valores del área de impresión.' };
		expect(printAreaFromForm(form({ x: '', y: '560', ancho: '600' }), bounds)).toEqual(invalid);
		expect(printAreaFromForm(form({ x: '-1', y: '560', ancho: '600' }), bounds)).toEqual(invalid);
		expect(printAreaFromForm(form({ x: '1.5', y: '560', ancho: '600' }), bounds)).toEqual(invalid);
		expect(printAreaFromForm(form({ x: '10', y: '560', ancho: '20' }), bounds)).toEqual(invalid);
	});
});
