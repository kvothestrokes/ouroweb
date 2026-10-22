import { describe, expect, it } from 'vitest';
import { garmentTypeFromForm } from './garment-type.js';

type Row = { talla: string; recargo?: string; ancho?: string; largo?: string };

function form(fields: Record<string, string>, rows: Row[]): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	for (const row of rows) {
		data.append('talla', row.talla);
		data.append('recargo', row.recargo ?? '');
		data.append('ancho', row.ancho ?? '');
		data.append('largo', row.largo ?? '');
	}
	return data;
}

const prices = {
	nombre: 'Playera',
	precio_normal: '170',
	precio_mayoreo: '150',
	mayoreo_cantidad_min: '6'
};

describe('garmentTypeFromForm', () => {
	it('reads sizes in order with their surcharge and measurements', () => {
		const result = garmentTypeFromForm(
			form(prices, [
				{ talla: 'ch', ancho: '46', largo: '66' },
				{ talla: 'M' },
				{ talla: 'XXG', recargo: '30', ancho: '58', largo: '76' }
			])
		);
		expect(result).toEqual({
			ok: true,
			value: {
				nombre: 'Playera',
				tallas: ['CH', 'M', 'XXG'],
				recargos_talla: { XXG: 3000 },
				guia_tallas: { CH: { ancho_cm: 46, largo_cm: 66 }, XXG: { ancho_cm: 58, largo_cm: 76 } },
				precio_normal: 17000,
				precio_mayoreo: 15000,
				mayoreo_cantidad_min: 6
			}
		});
	});

	it('leaves prices empty when they are not defined yet', () => {
		const result = garmentTypeFromForm(
			form(
				{ nombre: 'Sudadera', precio_normal: '', precio_mayoreo: '', mayoreo_cantidad_min: '' },
				[{ talla: 'M' }]
			)
		);
		expect(result.ok && result.value).toMatchObject({
			precio_normal: null,
			precio_mayoreo: null,
			mayoreo_cantidad_min: null
		});
	});

	it('explains invalid sizes', () => {
		expect(garmentTypeFromForm(form(prices, []))).toEqual({
			ok: false,
			message: 'Agrega al menos una talla.'
		});
		expect(garmentTypeFromForm(form(prices, [{ talla: 'M' }, { talla: 'm' }]))).toEqual({
			ok: false,
			message: 'La talla M está repetida.'
		});
		expect(garmentTypeFromForm(form(prices, [{ talla: 'Extra grande' }]))).toEqual({
			ok: false,
			message: 'Las tallas usan letras o números cortos (ej. CH, M, XXG).'
		});
		expect(garmentTypeFromForm(form(prices, [{ talla: 'M', recargo: 'mucho' }]))).toEqual({
			ok: false,
			message: 'Revisa el recargo de la talla M.'
		});
		expect(garmentTypeFromForm(form(prices, [{ talla: 'M', ancho: '50' }]))).toEqual({
			ok: false,
			message: 'Escribe ancho y largo de la talla M (o deja los dos vacíos).'
		});
	});

	it('explains invalid prices', () => {
		expect(
			garmentTypeFromForm(form({ ...prices, precio_mayoreo: '180' }, [{ talla: 'M' }]))
		).toEqual({ ok: false, message: 'El precio de mayoreo no puede ser mayor al precio normal.' });
		expect(
			garmentTypeFromForm(form({ ...prices, mayoreo_cantidad_min: '1' }, [{ talla: 'M' }]))
		).toEqual({ ok: false, message: 'El mayoreo aplica desde 2 piezas o más.' });
		expect(garmentTypeFromForm(form({ ...prices, precio_normal: 'x' }, [{ talla: 'M' }]))).toEqual({
			ok: false,
			message: 'Revisa el precio normal.'
		});
	});
});
