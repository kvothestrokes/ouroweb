import { describe, expect, it } from 'vitest';
import { customRequestFromForm, customRequestTypeFromForm } from './custom-request.js';

function form(fields: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('customRequestTypeFromForm', () => {
	it('reads name, "desde" price in pesos and visibility', () => {
		expect(
			customRequestTypeFromForm(
				form({ nombre: ' Termo grabado ', precio_desde: '250', activo: 'on' })
			)
		).toEqual({
			ok: true,
			value: { nombre: 'Termo grabado', precio_desde: 25000, activo: true }
		});
	});

	it('allows an empty price ("por cotizar") and hidden types', () => {
		expect(customRequestTypeFromForm(form({ nombre: 'Vela', precio_desde: '' }))).toEqual({
			ok: true,
			value: { nombre: 'Vela', precio_desde: null, activo: false }
		});
	});

	it('rejects a missing name or a bad price', () => {
		expect(customRequestTypeFromForm(form({ nombre: '' }))).toEqual({
			ok: false,
			message: 'Escribe el nombre del tipo de encargo.'
		});
		expect(customRequestTypeFromForm(form({ nombre: 'Taza', precio_desde: 'abc' }))).toEqual({
			ok: false,
			message: 'Escribe el precio «desde» en pesos (ej. 250).'
		});
	});
});

describe('customRequestFromForm', () => {
	const base = {
		tipo: '',
		descripcion: 'Un termo con el logo de mi equipo\ny mi nombre',
		cantidad: '3',
		fecha_deseada: '2026-11-20',
		nombre: 'Ana',
		whatsapp: '9612423984',
		metodoEntrega: 'recoger'
	};
	const today = new Date('2026-10-22T12:00:00Z');

	it('reads the request and the contact data', () => {
		const result = customRequestFromForm(form(base), today);
		expect(result).toEqual({
			ok: true,
			value: {
				request: {
					custom_request_type_id: null,
					descripcion: 'Un termo con el logo de mi equipo\ny mi nombre',
					cantidad: 3,
					fecha_deseada: '2026-11-20'
				},
				contact: {
					nombre: 'Ana',
					whatsapp: '529612423984',
					metodoEntrega: 'recoger',
					direccion: null,
					notas: ''
				}
			}
		});
	});

	it('reads the address for delivery', () => {
		const result = customRequestFromForm(
			form({
				...base,
				metodoEntrega: 'domicilio',
				calle: 'Av. Central 1',
				colonia: 'Centro',
				cp: '29000',
				ciudad: 'Tuxtla',
				estado: 'Chiapas'
			}),
			today
		);
		expect(result.ok && result.value.contact.direccion?.cp).toBe('29000');
	});

	it('rejects a missing description, a bad quantity or a past date', () => {
		expect(customRequestFromForm(form({ ...base, descripcion: ' ' }), today)).toEqual({
			ok: false,
			message: 'Cuéntanos qué te gustaría que hiciéramos.'
		});
		expect(customRequestFromForm(form({ ...base, cantidad: '0' }), today).ok).toBe(false);
		expect(customRequestFromForm(form({ ...base, fecha_deseada: '2026-10-01' }), today)).toEqual({
			ok: false,
			message: 'La fecha deseada debe ser de hoy en adelante.'
		});
		expect(customRequestFromForm(form({ ...base, fecha_deseada: '' }), today).ok).toBe(true);
	});
});
