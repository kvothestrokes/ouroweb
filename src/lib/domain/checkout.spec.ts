import { describe, expect, it } from 'vitest';
import { parseCheckout } from './checkout.js';

const valid = {
	nombre: '  Ana López ',
	whatsapp: '961 242 3984',
	metodoEntrega: 'recoger',
	notas: '',
	items: [{ slug: 'akatsuki', color: 'negro', talla: 'M', cantidad: 2, personalizacion: null }]
};

const address = {
	calle: 'Av. Central 123',
	colonia: 'Centro',
	cp: '29000',
	ciudad: 'Tuxtla Gutiérrez',
	estado: 'Chiapas',
	referencias: ''
};

describe('parseCheckout', () => {
	it('normalizes the customer data', () => {
		const result = parseCheckout(valid);
		expect(result.ok && result.value).toMatchObject({
			nombre: 'Ana López',
			whatsapp: '529612423984',
			metodoEntrega: 'recoger',
			direccion: null
		});
	});

	it('requires an address for home delivery and parcel, and drops it for pickup', () => {
		expect(parseCheckout({ ...valid, metodoEntrega: 'domicilio' })).toEqual({
			ok: false,
			message: 'Completa tu dirección de entrega.'
		});
		const parcel = parseCheckout({ ...valid, metodoEntrega: 'paqueteria', direccion: address });
		expect(parcel.ok && parcel.value.direccion).toEqual(address);
		const pickup = parseCheckout({ ...valid, direccion: address });
		expect(pickup.ok && pickup.value.direccion).toBeNull();
	});

	it('rejects a bad phone, an empty cart and bad quantities', () => {
		expect(parseCheckout({ ...valid, whatsapp: '123' })).toEqual({
			ok: false,
			message: 'Escribe tu WhatsApp a 10 dígitos.'
		});
		expect(parseCheckout({ ...valid, items: [] })).toEqual({
			ok: false,
			message: 'Tu carrito está vacío.'
		});
		expect(parseCheckout({ ...valid, items: [{ ...valid.items[0], cantidad: 0 }] }).ok).toBe(false);
		expect(parseCheckout({ ...valid, nombre: ' ' })).toEqual({
			ok: false,
			message: 'Escribe tu nombre.'
		});
	});

	it('rejects a postal code that is not 5 digits', () => {
		const result = parseCheckout({
			...valid,
			metodoEntrega: 'domicilio',
			direccion: { ...address, cp: '290' }
		});
		expect(result.ok).toBe(false);
	});
});

describe('free text', () => {
	it('flattens name and customization to one line and strips control and bidi characters', () => {
		const result = parseCheckout({
			...valid,
			nombre: 'Ana\nSubtotal: $0.00',
			notas: 'Línea 1\nLínea 2\u202E',
			items: [{ ...valid.items[0], personalizacion: 'Mi\r\nnombre\u0007' }]
		});
		expect(result.ok && result.value.nombre).toBe('Ana Subtotal: $0.00');
		expect(result.ok && result.value.notas).toBe('Línea 1\nLínea 2');
		expect(result.ok && result.value.items[0].personalizacion).toBe('Mi nombre');
	});
});
