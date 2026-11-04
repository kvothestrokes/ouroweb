import { describe, expect, it } from 'vitest';
import {
	adminCustomRequestFromForm,
	dedupeCustomers,
	manualOrderFromForm,
	orderDetailsFromForm,
	orderLinesFromForm,
	overrideStatuses,
	paymentFromForm,
	quoteFromForm,
	statusOverrideFromForm,
	templateVariables
} from './order-admin.js';

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

	it('parses optional discount overrides when present in the form', () => {
		expect(
			quoteFromForm(
				form({
					envio: '120',
					personalizacion: '50.5',
					precio_final: '',
					anticipo: '200',
					desc_mayoreo: '30',
					desc_cupon: ''
				})
			)
		).toEqual({
			ok: true,
			value: {
				envio: 12000,
				personalizacion: 5050,
				precio_final: null,
				anticipo: 20000,
				desc_mayoreo: 3000,
				desc_cupon: 0
			}
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

describe('orderDetailsFromForm', () => {
	it('normalizes phone and clears address when pickup is selected', () => {
		const res = orderDetailsFromForm(
			form({
				cliente_nombre: ' Ana López ',
				cliente_whatsapp: '961 123 4567',
				metodo_entrega: 'recoger',
				notas_cliente: 'Entregar en bolsa de regalo',
				guia: 'EST-123'
			})
		);
		expect(res).toEqual({
			ok: true,
			value: {
				cliente_nombre: 'Ana López',
				cliente_whatsapp: '529611234567',
				metodo_entrega: 'recoger',
				direccion: null,
				notas_cliente: 'Entregar en bolsa de regalo',
				guia: null
			}
		});
	});

	it('requires complete address for paqueteria and keeps tracking code', () => {
		const bad = orderDetailsFromForm(
			form({
				cliente_nombre: 'Ana',
				cliente_whatsapp: '9611234567',
				metodo_entrega: 'paqueteria'
			})
		);
		expect(bad.ok).toBe(false);

		const ok = orderDetailsFromForm(
			form({
				cliente_nombre: 'Ana',
				cliente_whatsapp: '9611234567',
				metodo_entrega: 'paqueteria',
				calle: 'Av. Central 100',
				colonia: 'Centro',
				cp: '29000',
				ciudad: 'Tuxtla',
				estado: 'Chiapas',
				referencias: 'Portón negro',
				guia: 'DHL-9988'
			})
		);
		expect(ok.ok).toBe(true);
		if (ok.ok) {
			expect(ok.value.guia).toBe('DHL-9988');
			expect(ok.value.direccion?.cp).toBe('29000');
		}
	});
});

describe('orderLinesFromForm', () => {
	it('parses catalog and free-form lines and computes subtotal in cents', () => {
		const res = orderLinesFromForm(
			form({
				items_json: JSON.stringify([
					{
						product_id: null,
						nombre_snapshot: 'Playera especial taller',
						color: 'Negro',
						talla: 'xxg',
						cantidad: 2,
						precio_pesos: '170',
						recargo_pesos: '30',
						personalizacion_texto: 'Nombre en espalda'
					}
				]),
				desc_mayoreo: '40'
			})
		);
		expect(res).toEqual({
			ok: true,
			value: {
				items: [
					{
						product_id: null,
						nombre_snapshot: 'Playera especial taller',
						color: 'Negro',
						talla: 'XXG',
						cantidad: 2,
						precio_unitario: 17000,
						recargo_talla: 3000,
						personalizacion_texto: 'Nombre en espalda'
					}
				],
				subtotal: 40000,
				desc_mayoreo: 4000
			}
		});
	});

	it('rejects empty lines or discount above subtotal', () => {
		expect(orderLinesFromForm(form({ items_json: '[]' })).ok).toBe(false);
		const overDiscount = orderLinesFromForm(
			form({
				items_json: JSON.stringify([{ nombre_snapshot: 'Taza', cantidad: 1, precio_pesos: '110' }]),
				desc_mayoreo: '150'
			})
		);
		expect(overDiscount.ok).toBe(false);
	});
});

describe('manualOrderFromForm', () => {
	it('validates a confirmed manual catalog order with initial deposit', () => {
		const res = manualOrderFromForm(
			form({
				tipo: 'catalogo',
				estado_inicial: 'confirmado',
				cliente_nombre: 'Carlos',
				cliente_whatsapp: '9612423984',
				metodo_entrega: 'recoger',
				items_json: JSON.stringify([
					{
						nombre_snapshot: 'Playera Zoro',
						color: 'Negro',
						talla: 'M',
						cantidad: 2,
						precio_pesos: '170'
					}
				]),
				desc_mayoreo: '0',
				desc_cupon: '20',
				personalizacion: '30',
				envio: '100',
				anticipo_requerido: '175',
				pago_inicial_tipo: 'anticipo',
				pago_inicial_monto: '175',
				pago_inicial_metodo: 'Transferencia BBVA'
			})
		);
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.envio).toBe(0);
			expect(res.value.total).toBe(35000);
			expect(res.value.initialPayment).toEqual({
				tipo: 'anticipo',
				monto: 17500,
				metodo: 'Transferencia BBVA'
			});
		}
	});

	it('rejects confirmed initial state when no deposit payment is provided', () => {
		const res = manualOrderFromForm(
			form({
				tipo: 'catalogo',
				estado_inicial: 'confirmado',
				cliente_nombre: 'Carlos',
				cliente_whatsapp: '9612423984',
				metodo_entrega: 'recoger',
				items_json: JSON.stringify([
					{ nombre_snapshot: 'Playera Zoro', cantidad: 1, precio_pesos: '170' }
				])
			})
		);
		expect(res.ok).toBe(false);
	});
});

describe('statusOverrideFromForm & overrideStatuses', () => {
	it('filters out current status and incompatible delivery statuses', () => {
		const pickupList = overrideStatuses('cancelado', 'recoger');
		expect(pickupList).not.toContain('cancelado');
		expect(pickupList).not.toContain('enviado');
		expect(pickupList).toContain('listo_para_recoger');

		const shippingList = overrideStatuses('listo', 'paqueteria');
		expect(shippingList).toContain('enviado');
		expect(shippingList).not.toContain('listo_para_recoger');
	});

	it('requires a reason note of at least 3 characters', () => {
		const noNote = statusOverrideFromForm(
			form({ estado: 'en_produccion', nota: '' }),
			'listo',
			'recoger'
		);
		expect(noNote.ok).toBe(false);

		const valid = statusOverrideFromForm(
			form({ estado: 'en_produccion', nota: 'Se marcó listo por error' }),
			'listo',
			'recoger'
		);
		expect(valid).toEqual({
			ok: true,
			value: { estado: 'en_produccion', nota: 'Se marcó listo por error' }
		});
	});
});

describe('adminCustomRequestFromForm & dedupeCustomers', () => {
	it('parses custom request fields', () => {
		const res = adminCustomRequestFromForm(
			form({
				descripcion: 'Sudadera bordada',
				cantidad: '3',
				fecha_deseada: '2026-12-01',
				precio_final: '950'
			})
		);
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.precio_final).toBe(95000);
			expect(res.value.cantidad).toBe(3);
		}
	});

	it('deduplicates customers by whatsapp keeping the latest address', () => {
		const list = dedupeCustomers([
			{
				cliente_nombre: 'María',
				cliente_whatsapp: '529611112233',
				metodo_entrega: 'recoger',
				direccion: null
			},
			{
				cliente_nombre: 'María Antiguo',
				cliente_whatsapp: '529611112233',
				metodo_entrega: 'domicilio',
				direccion: {
					calle: 'Calle 1',
					colonia: 'Centro',
					cp: '29000',
					ciudad: 'Tuxtla',
					estado: 'Chiapas',
					referencias: ''
				}
			}
		]);
		expect(list).toHaveLength(1);
		expect(list[0].cliente_nombre).toBe('María');
		expect(list[0].whatsapp_nacional).toBe('9611112233');
		expect(list[0].direccion?.calle).toBe('Calle 1');
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
