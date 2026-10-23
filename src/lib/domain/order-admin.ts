import type { FormResult } from './catalog.js';
import { deliveryLabel, type DeliveryMethod } from './checkout.js';
import { formatMoney, parseMoney } from './money.js';
import { summaryLine } from './whatsapp.js';

export type QuoteInput = {
	/** Cents; null = still "por cotizar". */
	envio: number | null;
	personalizacion: number | null;
	/** Special requests only. */
	precio_final: number | null;
	anticipo: number | null;
};

const QUOTE_FIELDS = [
	['envio', 'el costo de envío'],
	['personalizacion', 'el costo de personalización'],
	['precio_final', 'el precio del encargo'],
	['anticipo', 'el anticipo']
] as const;

export function quoteFromForm(form: FormData): FormResult<QuoteInput> {
	const value = {} as QuoteInput;
	for (const [name, label] of QUOTE_FIELDS) {
		const amount = parseMoney(form.get(name));
		if (Number.isNaN(amount)) return { ok: false, message: `Revisa ${label}.` };
		value[name] = amount;
	}
	return { ok: true, value };
}

export const PAYMENT_TYPES = [
	{ value: 'anticipo', label: 'Anticipo' },
	{ value: 'abono', label: 'Abono' },
	{ value: 'liquidacion', label: 'Liquidación' }
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number]['value'];

export type PaymentInput = {
	tipo: PaymentType;
	monto: number;
	metodo: string;
	fecha: string | null;
};

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

export function paymentFromForm(form: FormData): FormResult<PaymentInput> {
	const tipo = text(form, 'tipo');
	if (!PAYMENT_TYPES.some((option) => option.value === tipo)) {
		return { ok: false, message: 'Elige el tipo de pago.' };
	}
	const monto = parseMoney(text(form, 'monto'));
	if (monto === null || Number.isNaN(monto) || monto <= 0) {
		return { ok: false, message: 'Escribe el monto del pago.' };
	}
	const fecha = text(form, 'fecha');
	if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))) {
		return { ok: false, message: 'Revisa la fecha del pago.' };
	}
	return {
		ok: true,
		value: {
			tipo: tipo as PaymentType,
			monto,
			metodo: text(form, 'metodo').slice(0, 60),
			// Noon UTC keeps the same calendar day in Mexico.
			fecha: fecha ? new Date(`${fecha}T12:00:00Z`).toISOString() : null
		}
	};
}

type TemplateOrder = {
	folio: string;
	cliente_nombre: string;
	metodo_entrega: DeliveryMethod;
	subtotal: number;
	desc_mayoreo: number;
	desc_cupon: number;
	personalizacion: number | null;
	envio: number | null;
	total: number;
	anticipo_requerido: number | null;
	guia: string | null;
};

type TemplateItem = {
	cantidad: number;
	nombre_snapshot: string;
	color: string | null;
	talla: string | null;
	precio_unitario: number;
	recargo_talla: number;
	personalizacion_texto: string | null;
};

const quoted = (cents: number | null) => (cents === null ? 'por cotizar' : formatMoney(cents));

/** Values for `{{variable}}` in WhatsApp templates (spec section 8). */
export function templateVariables({
	order,
	items,
	pagado,
	settings,
	trackingUrl
}: {
	order: TemplateOrder;
	items: TemplateItem[];
	pagado: number;
	settings: { datos_bancarios: string; direccion_taller: string; horarios: string };
	trackingUrl: string;
}): Record<string, string> {
	return {
		folio: order.folio,
		nombre: order.cliente_nombre,
		metodo_entrega: deliveryLabel(order.metodo_entrega),
		resumen: items
			.map((item) =>
				summaryLine({
					cantidad: item.cantidad,
					nombre: item.nombre_snapshot,
					color: item.color,
					talla: item.talla,
					importe: (item.precio_unitario + item.recargo_talla) * item.cantidad,
					personalizacion: item.personalizacion_texto
				})
			)
			.join('\n'),
		subtotal: formatMoney(order.subtotal),
		descuentos: formatMoney(order.desc_mayoreo + order.desc_cupon),
		personalizacion: quoted(order.personalizacion),
		envio: quoted(order.envio),
		total: formatMoney(order.total),
		anticipo: quoted(order.anticipo_requerido),
		pagado: formatMoney(pagado),
		saldo: formatMoney(order.total - pagado),
		datos_bancarios: settings.datos_bancarios,
		direccion_taller: [settings.direccion_taller, settings.horarios].filter(Boolean).join('\n'),
		guia: order.guia ?? '',
		link_seguimiento: trackingUrl
	};
}
