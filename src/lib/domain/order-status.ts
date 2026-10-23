import type { DeliveryMethod } from './checkout.js';

export const STATUSES = [
	'pendiente',
	'esperando_anticipo',
	'confirmado',
	'en_produccion',
	'listo',
	'enviado',
	'listo_para_recoger',
	'entregado',
	'cancelado'
] as const;

export type OrderStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
	pendiente: 'Pendiente',
	esperando_anticipo: 'Esperando anticipo',
	confirmado: 'Confirmado',
	en_produccion: 'En producción',
	listo: 'Listo',
	enviado: 'Enviado',
	listo_para_recoger: 'Listo para recoger',
	entregado: 'Entregado',
	cancelado: 'Cancelado'
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pendiente: ['esperando_anticipo', 'cancelado'],
	esperando_anticipo: ['confirmado', 'cancelado'],
	confirmado: ['en_produccion', 'cancelado'],
	en_produccion: ['listo'],
	listo: ['enviado', 'listo_para_recoger'],
	enviado: ['entregado'],
	listo_para_recoger: ['entregado'],
	entregado: [],
	cancelado: []
};

/** Allowed next statuses (spec 6.4); "listo" branches by delivery method. */
export function nextStatuses(status: OrderStatus, delivery: DeliveryMethod): OrderStatus[] {
	if (status === 'listo') return [delivery === 'recoger' ? 'listo_para_recoger' : 'enviado'];
	return TRANSITIONS[status];
}

const TEMPLATES: Partial<Record<OrderStatus, string>> = {
	esperando_anticipo: 'cotizacion_anticipo',
	confirmado: 'anticipo_recibido',
	en_produccion: 'en_produccion',
	listo_para_recoger: 'listo_recoger',
	enviado: 'enviado',
	entregado: 'entregado_resena',
	cancelado: 'cancelado'
};

/** `wa_templates.clave` for the "Avisar por WhatsApp" button of a status. */
export function templateForStatus(status: OrderStatus): string | null {
	return TEMPLATES[status] ?? null;
}
