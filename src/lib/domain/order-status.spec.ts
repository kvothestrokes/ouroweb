import { describe, expect, it } from 'vitest';
import { STATUS_LABELS, nextStatuses, templateForStatus } from './order-status.js';

describe('nextStatuses', () => {
	it('follows the spec diagram (6.4)', () => {
		expect(nextStatuses('pendiente', 'recoger')).toEqual(['esperando_anticipo', 'cancelado']);
		expect(nextStatuses('esperando_anticipo', 'recoger')).toEqual(['confirmado', 'cancelado']);
		expect(nextStatuses('confirmado', 'recoger')).toEqual(['en_produccion', 'cancelado']);
		expect(nextStatuses('en_produccion', 'recoger')).toEqual(['listo']);
		expect(nextStatuses('entregado', 'recoger')).toEqual([]);
		expect(nextStatuses('cancelado', 'recoger')).toEqual([]);
	});

	it('sends ready orders to pickup or shipping by delivery method', () => {
		expect(nextStatuses('listo', 'recoger')).toEqual(['listo_para_recoger']);
		expect(nextStatuses('listo', 'domicilio')).toEqual(['enviado']);
		expect(nextStatuses('listo', 'paqueteria')).toEqual(['enviado']);
		expect(nextStatuses('enviado', 'paqueteria')).toEqual(['entregado']);
		expect(nextStatuses('listo_para_recoger', 'recoger')).toEqual(['entregado']);
	});
});

describe('labels and templates', () => {
	it('has a visible label for every status', () => {
		expect(STATUS_LABELS.esperando_anticipo).toBe('Esperando anticipo');
		expect(STATUS_LABELS.listo_para_recoger).toBe('Listo para recoger');
	});

	it('maps statuses to their WhatsApp template (spec section 8)', () => {
		expect(templateForStatus('esperando_anticipo')).toBe('cotizacion_anticipo');
		expect(templateForStatus('confirmado')).toBe('anticipo_recibido');
		expect(templateForStatus('listo_para_recoger')).toBe('listo_recoger');
		expect(templateForStatus('entregado')).toBe('entregado_resena');
		expect(templateForStatus('pendiente')).toBeNull();
		expect(templateForStatus('listo')).toBeNull();
	});
});
