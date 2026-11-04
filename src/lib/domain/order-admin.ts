import { z } from 'zod';
import type { FormResult } from './catalog.js';
import {
	cleanText,
	deliveryLabel,
	parseContact,
	type Address,
	type DeliveryMethod
} from './checkout.js';
import { parseSizeBreakdown, type SizeBreakdownItem } from './custom-request.js';
import { formatMoney, parseMoney } from './money.js';
import { STATUSES, type OrderStatus } from './order-status.js';
import { summaryLine } from './whatsapp.js';

export type QuoteInput = {
	/** Cents; null = still "por cotizar". */
	envio: number | null;
	personalizacion: number | null;
	/** Special requests only. */
	precio_final: number | null;
	anticipo: number | null;
	/** Optional discount overrides (cents); omitted when not present in form. */
	desc_mayoreo?: number | null;
	desc_cupon?: number | null;
};

const QUOTE_FIELDS = [
	['envio', 'el costo de envío'],
	['personalizacion', 'el costo de personalización'],
	['precio_final', 'el precio'],
	['anticipo', 'el anticipo']
] as const;

const DISCOUNT_FIELDS = [
	['desc_mayoreo', 'el descuento de mayoreo'],
	['desc_cupon', 'el descuento adicional']
] as const;

export function quoteFromForm(form: FormData): FormResult<QuoteInput> {
	const value: QuoteInput = {
		envio: null,
		personalizacion: null,
		precio_final: null,
		anticipo: null
	};
	for (const [name, label] of QUOTE_FIELDS) {
		const amount = parseMoney(form.get(name));
		if (Number.isNaN(amount)) return { ok: false, message: `Revisa ${label}.` };
		value[name] = amount;
	}
	for (const [name, label] of DISCOUNT_FIELDS) {
		if (!form.has(name)) continue;
		const amount = parseMoney(form.get(name));
		if (Number.isNaN(amount)) return { ok: false, message: `Revisa ${label}.` };
		value[name] = amount ?? 0;
	}
	return { ok: true, value };
}

export const PAYMENT_TYPES = [
	{ value: 'anticipo', label: 'Anticipo' },
	{ value: 'abono', label: 'Abono' },
	{ value: 'liquidacion', label: 'Liquidación' }
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number]['value'];

export const PAYMENT_METHODS = [
	'Transferencia',
	'Efectivo',
	'Tarjeta',
	'Depósito en efectivo',
	'OXXO',
	'Otro'
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
	const rawMetodo = text(form, 'metodo');
	const metodoOtro = text(form, 'metodo_otro');
	const metodo = (
		rawMetodo === 'Otro' && metodoOtro ? metodoOtro : rawMetodo || 'Transferencia'
	).slice(0, 60);

	return {
		ok: true,
		value: {
			tipo: tipo as PaymentType,
			monto,
			metodo,
			// Noon UTC keeps the same calendar day in Mexico.
			fecha: fecha ? new Date(`${fecha}T12:00:00Z`).toISOString() : null
		}
	};
}

export type OrderDetailsInput = {
	cliente_nombre: string;
	cliente_whatsapp: string;
	metodo_entrega: DeliveryMethod;
	direccion: Address | null;
	notas_cliente: string;
	guia: string | null;
};

export function orderDetailsFromForm(form: FormData): FormResult<OrderDetailsInput> {
	const metodoEntrega = text(form, 'metodo_entrega') || text(form, 'metodoEntrega');
	const contact = parseContact({
		nombre: text(form, 'cliente_nombre') || text(form, 'nombre'),
		whatsapp: text(form, 'cliente_whatsapp') || text(form, 'whatsapp'),
		metodoEntrega,
		notas: text(form, 'notas_cliente') || text(form, 'notas'),
		direccion:
			metodoEntrega === 'recoger'
				? undefined
				: {
						calle: text(form, 'calle'),
						colonia: text(form, 'colonia'),
						cp: text(form, 'cp'),
						ciudad: text(form, 'ciudad'),
						estado: text(form, 'estado'),
						referencias: text(form, 'referencias')
					}
	});
	if (!contact.ok) return contact;

	const guia = cleanText(text(form, 'guia')).slice(0, 80);
	return {
		ok: true,
		value: {
			cliente_nombre: contact.value.nombre,
			cliente_whatsapp: contact.value.whatsapp,
			metodo_entrega: contact.value.metodoEntrega,
			direccion: contact.value.direccion,
			notas_cliente: contact.value.notas,
			guia: contact.value.metodoEntrega === 'paqueteria' && guia ? guia : null
		}
	};
}

export type AdminOrderLineInput = {
	product_id: string | null;
	nombre_snapshot: string;
	color: string | null;
	talla: string | null;
	cantidad: number;
	precio_unitario: number;
	recargo_talla: number;
	personalizacion_texto: string | null;
};

const rawLineSchema = z.object({
	product_id: z.string().nullable().optional(),
	nombre_snapshot: z.string(),
	color: z.string().nullable().optional(),
	talla: z.string().nullable().optional(),
	cantidad: z.union([z.number(), z.string()]),
	precio_pesos: z.union([z.number(), z.string()]).optional(),
	precio_unitario: z.number().int().nonnegative().optional(),
	recargo_pesos: z.union([z.number(), z.string()]).optional(),
	recargo_talla: z.number().int().nonnegative().optional(),
	personalizacion_texto: z.string().nullable().optional()
});

export function orderLinesFromForm(
	form: FormData
): FormResult<{ items: AdminOrderLineInput[]; subtotal: number; desc_mayoreo: number | null }> {
	const rawJson = text(form, 'items_json');
	if (!rawJson) return { ok: false, message: 'Agrega al menos una partida al pedido.' };

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawJson);
	} catch {
		return { ok: false, message: 'No pudimos leer las partidas del pedido.' };
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		return { ok: false, message: 'Agrega al menos una partida al pedido.' };
	}
	if (parsed.length > 50) {
		return { ok: false, message: 'Cada pedido admite hasta 50 partidas.' };
	}

	const items: AdminOrderLineInput[] = [];
	let subtotal = 0;

	for (let index = 0; index < parsed.length; index++) {
		const row = rawLineSchema.safeParse(parsed[index]);
		if (!row.success) {
			return { ok: false, message: `Revisa los datos de la partida #${index + 1}.` };
		}
		const data = row.data;
		const nombre = cleanText(data.nombre_snapshot).slice(0, 120);
		if (!nombre) {
			return { ok: false, message: `Escribe el nombre del producto en la partida #${index + 1}.` };
		}

		const productId = data.product_id?.trim() || null;
		if (productId && !z.uuid().safeParse(productId).success) {
			return { ok: false, message: `El producto de la partida #${index + 1} no es válido.` };
		}

		const cantidad = Number(data.cantidad);
		if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
			return {
				ok: false,
				message: `La cantidad en la partida #${index + 1} debe ser entre 1 y 999.`
			};
		}

		const precioUnitario =
			data.precio_unitario !== undefined
				? data.precio_unitario
				: parseMoney(String(data.precio_pesos ?? ''));
		if (precioUnitario === null || Number.isNaN(precioUnitario) || precioUnitario < 0) {
			return { ok: false, message: `Revisa el precio unitario en la partida #${index + 1}.` };
		}

		const recargoRaw =
			data.recargo_talla !== undefined
				? data.recargo_talla
				: (parseMoney(String(data.recargo_pesos ?? '')) ?? 0);
		if (Number.isNaN(recargoRaw) || recargoRaw < 0) {
			return { ok: false, message: `Revisa el recargo de talla en la partida #${index + 1}.` };
		}

		const color = cleanText(data.color ?? '').slice(0, 60) || null;
		const talla =
			cleanText(data.talla ?? '')
				.toUpperCase()
				.slice(0, 15) || null;
		const personalizacion = cleanText(data.personalizacion_texto ?? '', true).slice(0, 500) || null;

		items.push({
			product_id: productId,
			nombre_snapshot: nombre,
			color,
			talla,
			cantidad,
			precio_unitario: precioUnitario,
			recargo_talla: recargoRaw,
			personalizacion_texto: personalizacion
		});
		subtotal += (precioUnitario + recargoRaw) * cantidad;
	}

	let descMayoreo: number | null = null;
	if (form.has('desc_mayoreo')) {
		const parsedMayoreo = parseMoney(form.get('desc_mayoreo'));
		if (Number.isNaN(parsedMayoreo)) {
			return { ok: false, message: 'Revisa el descuento de mayoreo.' };
		}
		descMayoreo = parsedMayoreo ?? 0;
		if (descMayoreo > subtotal) {
			return { ok: false, message: 'El descuento de mayoreo no puede superar el subtotal.' };
		}
	}

	return { ok: true, value: { items, subtotal, desc_mayoreo: descMayoreo } };
}

export type AdminCustomRequestInput = {
	custom_request_type_id: string | null;
	descripcion: string;
	cantidad: number;
	fecha_deseada: string | null;
	precio_final: number | null;
	tipo_producto?: string | null;
	color?: string | null;
	desglose_tallas?: SizeBreakdownItem[];
};

export function adminCustomRequestFromForm(form: FormData): FormResult<AdminCustomRequestInput> {
	const typeId = text(form, 'custom_request_type_id');
	if (typeId && !z.uuid().safeParse(typeId).success) {
		return { ok: false, message: 'Elige un tipo de encargo válido.' };
	}

	const descripcion = cleanText(text(form, 'descripcion'), true);
	if (!descripcion) {
		return { ok: false, message: 'Escribe la descripción del encargo.' };
	}
	if (descripcion.length > 1000) {
		return { ok: false, message: 'La descripción es muy larga (máximo 1000 caracteres).' };
	}

	const tipoProducto = cleanText(text(form, 'tipo_producto'), false) || null;
	const color = cleanText(text(form, 'color'), false) || null;
	const desgloseTallas = parseSizeBreakdown(form.get('desglose_tallas'));

	let cantidad = Number(text(form, 'cantidad') || '1');
	if (desgloseTallas.length > 0) {
		const totalPieces = desgloseTallas.reduce((sum, item) => sum + item.cantidad, 0);
		if (totalPieces > 0) {
			cantidad = totalPieces;
		}
	}

	if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
		return { ok: false, message: 'La cantidad del encargo debe ser de 1 a 999 piezas.' };
	}

	const fecha = text(form, 'fecha_deseada');
	if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))) {
		return { ok: false, message: 'Revisa la fecha deseada.' };
	}

	const precioFinal = parseMoney(form.get('precio_final'));
	if (Number.isNaN(precioFinal)) {
		return { ok: false, message: 'Revisa el precio del encargo.' };
	}

	return {
		ok: true,
		value: {
			custom_request_type_id: typeId || null,
			descripcion,
			cantidad,
			fecha_deseada: fecha || null,
			precio_final: precioFinal,
			tipo_producto: tipoProducto,
			color,
			desglose_tallas: desgloseTallas
		}
	};
}

export type ManualOrderInput = {
	tipo: 'catalogo' | 'encargo';
	estado: 'pendiente' | 'esperando_anticipo' | 'confirmado';
	details: OrderDetailsInput;
	items: AdminOrderLineInput[];
	request: AdminCustomRequestInput | null;
	subtotal: number;
	desc_mayoreo: number;
	desc_cupon: number;
	personalizacion: number | null;
	envio: number | null;
	anticipo_requerido: number | null;
	total: number;
	initialPayment: {
		tipo: PaymentType;
		monto: number;
		metodo: string;
	} | null;
};

export function manualOrderFromForm(form: FormData): FormResult<ManualOrderInput> {
	const tipo = text(form, 'tipo');
	if (tipo !== 'catalogo' && tipo !== 'encargo') {
		return { ok: false, message: 'Elige si el pedido es de catálogo o encargo especial.' };
	}

	const estado = (text(form, 'estado_inicial') || 'pendiente') as ManualOrderInput['estado'];
	if (!['pendiente', 'esperando_anticipo', 'confirmado'].includes(estado)) {
		return { ok: false, message: 'El estado inicial no es válido.' };
	}

	const details = orderDetailsFromForm(form);
	if (!details.ok) return details;

	let items: AdminOrderLineInput[] = [];
	let request: AdminCustomRequestInput | null = null;
	let subtotal: number;

	if (tipo === 'catalogo') {
		const lines = orderLinesFromForm(form);
		if (!lines.ok) return lines;
		items = lines.value.items;
		subtotal = lines.value.subtotal;
	} else {
		const parsedReq = adminCustomRequestFromForm(form);
		if (!parsedReq.ok) return parsedReq;
		request = parsedReq.value;
		subtotal = request.precio_final ?? 0;
	}

	const descMayoreo = parseMoney(form.get('desc_mayoreo')) ?? 0;
	if (Number.isNaN(descMayoreo) || descMayoreo < 0) {
		return { ok: false, message: 'Revisa el descuento de mayoreo.' };
	}

	const descCupon = parseMoney(form.get('desc_cupon')) ?? 0;
	if (Number.isNaN(descCupon) || descCupon < 0) {
		return { ok: false, message: 'Revisa el descuento adicional.' };
	}

	if (descMayoreo + descCupon > subtotal) {
		return { ok: false, message: 'Los descuentos no pueden ser mayores al subtotal.' };
	}

	const personalizacion = parseMoney(form.get('personalizacion'));
	if (Number.isNaN(personalizacion)) {
		return { ok: false, message: 'Revisa el costo de personalización.' };
	}

	const rawEnvio = parseMoney(form.get('envio'));
	if (Number.isNaN(rawEnvio)) {
		return { ok: false, message: 'Revisa el costo de envío.' };
	}
	const envio = details.value.metodo_entrega === 'recoger' ? 0 : rawEnvio;

	const total = subtotal - descMayoreo - descCupon + (personalizacion ?? 0) + (envio ?? 0);

	const anticipo = parseMoney(form.get('anticipo_requerido'));
	if (Number.isNaN(anticipo)) {
		return { ok: false, message: 'Revisa el anticipo requerido.' };
	}
	if (anticipo !== null && anticipo > total) {
		return { ok: false, message: 'El anticipo requerido no puede superar el total.' };
	}

	const pagoMonto = parseMoney(form.get('pago_inicial_monto'));
	if (Number.isNaN(pagoMonto)) {
		return { ok: false, message: 'Revisa el monto del pago inicial.' };
	}

	let initialPayment: ManualOrderInput['initialPayment'] = null;
	if (pagoMonto !== null && pagoMonto > 0) {
		if (pagoMonto > total) {
			return { ok: false, message: 'El pago inicial no puede ser mayor que el total del pedido.' };
		}
		const pagoTipo = (text(form, 'pago_inicial_tipo') || 'anticipo') as PaymentType;
		if (!PAYMENT_TYPES.some((option) => option.value === pagoTipo)) {
			return { ok: false, message: 'Elige el tipo del pago inicial.' };
		}
		const rawMetodo = text(form, 'pago_inicial_metodo');
		const metodoOtro = text(form, 'pago_inicial_metodo_otro');
		const metodo =
			cleanText(rawMetodo === 'Otro' && metodoOtro ? metodoOtro : rawMetodo).slice(0, 60) ||
			'Transferencia';
		initialPayment = {
			tipo: pagoTipo,
			monto: pagoMonto,
			metodo
		};
	}

	if (estado === 'confirmado' && (!initialPayment || initialPayment.tipo !== 'anticipo')) {
		return {
			ok: false,
			message: 'Para crear el pedido como Confirmado, registra un pago inicial de tipo Anticipo.'
		};
	}

	return {
		ok: true,
		value: {
			tipo,
			estado,
			details: details.value,
			items,
			request,
			subtotal,
			desc_mayoreo: descMayoreo,
			desc_cupon: descCupon,
			personalizacion,
			envio,
			anticipo_requerido: anticipo,
			total,
			initialPayment
		}
	};
}

/** Valid target statuses when correcting/reopening an order status (Spec S4). */
export function overrideStatuses(
	currentStatus: OrderStatus,
	delivery: DeliveryMethod
): OrderStatus[] {
	return STATUSES.filter((candidate) => {
		if (candidate === currentStatus) return false;
		if (candidate === 'enviado' && delivery === 'recoger') return false;
		if (candidate === 'listo_para_recoger' && delivery !== 'recoger') return false;
		return true;
	});
}

export function statusOverrideFromForm(
	form: FormData,
	currentStatus: OrderStatus,
	delivery: DeliveryMethod
): FormResult<{ estado: OrderStatus; nota: string }> {
	const estado = text(form, 'estado') as OrderStatus;
	const allowed = overrideStatuses(currentStatus, delivery);
	if (!allowed.includes(estado)) {
		return { ok: false, message: 'Elige un estado válido para corregir el pedido.' };
	}
	const nota = cleanText(text(form, 'nota')).slice(0, 300);
	if (nota.length < 3) {
		return {
			ok: false,
			message: 'Escribe el motivo de la corrección o reapertura (mínimo 3 caracteres).'
		};
	}
	return { ok: true, value: { estado, nota } };
}

export type RecurringCustomer = {
	cliente_nombre: string;
	/** 10 national digits for input display (`9611234567`). */
	whatsapp_nacional: string;
	cliente_whatsapp: string;
	metodo_entrega: DeliveryMethod;
	direccion: Address | null;
};

/** Deduplicates recent orders by WhatsApp number so the admin can prefill recurring customers. */
export function dedupeCustomers(
	rows: {
		cliente_nombre: string;
		cliente_whatsapp: string;
		metodo_entrega: DeliveryMethod;
		direccion: unknown;
	}[]
): RecurringCustomer[] {
	const seen = new Map<string, RecurringCustomer>();
	for (const row of rows) {
		const key = row.cliente_whatsapp;
		if (!key) continue;
		const existing = seen.get(key);
		const addressObj =
			row.direccion && typeof row.direccion === 'object' && !Array.isArray(row.direccion)
				? (row.direccion as Address)
				: null;
		if (!existing) {
			seen.set(key, {
				cliente_nombre: row.cliente_nombre,
				whatsapp_nacional: key.replace(/^52/, ''),
				cliente_whatsapp: key,
				metodo_entrega: row.metodo_entrega,
				direccion: addressObj
			});
		} else if (!existing.direccion && addressObj) {
			existing.direccion = addressObj;
		}
	}
	return [...seen.values()];
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
