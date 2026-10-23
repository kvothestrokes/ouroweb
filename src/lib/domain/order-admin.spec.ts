import { describe, expect, it } from 'vitest';
import { paymentFromForm, quoteFromForm, templateVariables } from './order-admin.js';

function form(fields: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('quoteFromForm', () => {
	it('reads amounts in pesos; empty fields stay "por cotizar"', () => {
		expect(
			quoteFromForm(
				form({ envio: '150', personalizacion: '', precio_final: '', anticipo: '270.50' })
			)
		).toEqual({
			ok: true,
			value: { envio: 15000, personalizacion: null, precio_final: null, anticipo: 27050 }
		});
	});

	it('rejects amounts that are not money', () => {
		expect(quoteFromForm(form({ envio: 'gratis' }))).toEqual({
			ok: false,
			message: 'Revisa el costo de envío.'
		});
	});
});

describe('paymentFromForm', () => {
	it('reads type, amount, method and date', () => {
		expect(
			paymentFromForm(
				form({ tipo: 'anticipo', monto: '270', metodo: ' Transferencia ', fecha: '2026-10-22' })
			)
		).toEqual({
			ok: true,
			value: {
				tipo: 'anticipo',
				monto: 27000,
				metodo: 'Transferencia',
				fecha: '2026-10-22T12:00:00.000Z'
			}
		});
	});

	it('requires a positive amount and a known type', () => {
		expect(paymentFromForm(form({ tipo: 'anticipo', monto: '0' })).ok).toBe(false);
		expect(paymentFromForm(form({ tipo: 'regalo', monto: '10' })).ok).toBe(false);
	});
});

describe('templateVariables', () => {
	it('fills money, delivery, summary, balance and business data', () => {
		const variables = templateVariables({
			order: {
				folio: 'OUR-2610-0001',
				cliente_nombre: 'Ana',
				metodo_entrega: 'paqueteria',
				subtotal: 34000,
				desc_mayoreo: 0,
				desc_cupon: 0,
				personalizacion: null,
				envio: 15000,
				total: 49000,
				anticipo_requerido: 24500,
				guia: null
			},
			items: [
				{
					cantidad: 2,
					nombre_snapshot: 'Playera',
					color: 'Negro',
					talla: 'M',
					precio_unitario: 17000,
					recargo_talla: 0,
					personalizacion_texto: null
				}
			],
			pagado: 24500,
			settings: { datos_bancarios: 'BBVA 0123', direccion_taller: 'Calle 1', horarios: '' },
			trackingUrl: 'https://ouroboros.mx/seguimiento'
		});
		expect(variables).toMatchObject({
			folio: 'OUR-2610-0001',
			nombre: 'Ana',
			metodo_entrega: 'Paquetería nacional',
			resumen: '• 2× Playera · Negro · M — $340.00',
			subtotal: '$340.00',
			descuentos: '$0.00',
			personalizacion: 'por cotizar',
			envio: '$150.00',
			total: '$490.00',
			anticipo: '$245.00',
			pagado: '$245.00',
			saldo: '$245.00',
			datos_bancarios: 'BBVA 0123',
			direccion_taller: 'Calle 1',
			guia: '',
			link_seguimiento: 'https://ouroboros.mx/seguimiento'
		});
	});
});
