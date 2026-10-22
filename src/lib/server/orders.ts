import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
import { deliveryLabel, type Checkout } from '#lib/domain/checkout.js';
import { formatMoney } from '#lib/domain/money.js';
import { buildOrderLines, type OrderLines } from '#lib/domain/order-lines.js';
import { renderTemplate, summaryLine, whatsappLink } from '#lib/domain/whatsapp.js';
import { StoreUnavailableError, loadProductDetails } from './store.js';
import { supabaseAdmin } from './supabase-admin.js';

export type PlacedOrder = {
	folio: string;
	whatsappUrl: string;
	lines: { nombre: string; detalle: string; cantidad: number; importe: number }[];
	subtotal: number;
	descMayoreo: number;
	total: number;
	/** Shipping and customization are still to be quoted. */
	porCotizar: boolean;
};

export type OrderResult =
	{ ok: true; order: PlacedOrder } | { ok: false; status: 400 | 429 | 503; message: string };

// Used only if the `pedido_nuevo` template row is missing (spec section 8).
const FALLBACK_TEMPLATE = `¡Hola, Ouroboros! 🐍✨
Acabo de hacer mi pedido *{{folio}}*

👤 {{nombre}}
📦 Entrega: {{metodo_entrega}}

{{resumen}}

Subtotal: {{subtotal}}
Envío y personalización: por cotizar`;

async function orderTemplate(): Promise<string> {
	const { data } = await supabaseAdmin
		.from('wa_templates')
		.select('cuerpo')
		.eq('clave', 'pedido_nuevo')
		.maybeSingle();
	return data?.cuerpo ?? FALLBACK_TEMPLATE;
}

function whatsappMessage(template: string, folio: string, checkout: Checkout, lines: OrderLines) {
	const resumen = lines.items
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
		.join('\n');
	const descuentos = lines.descMayoreo ? `Mayoreo: −${formatMoney(lines.descMayoreo)}` : '';
	return renderTemplate(template, {
		folio,
		nombre: checkout.nombre,
		metodo_entrega: deliveryLabel(checkout.metodoEntrega),
		resumen: descuentos ? `${resumen}\n\n${descuentos}` : resumen,
		subtotal: formatMoney(lines.subtotal - lines.descMayoreo),
		descuentos
	});
}

/** Spec 6.1: validates the cart against the catalog, prices it and saves the order. */
export async function placeOrder(checkout: Checkout): Promise<OrderResult> {
	let products;
	try {
		products = await loadProductDetails([...new Set(checkout.items.map((item) => item.slug))]);
	} catch (cause) {
		if (cause instanceof StoreUnavailableError) {
			return {
				ok: false,
				status: 503,
				message: 'No pudimos registrar tu pedido. Intenta de nuevo en unos minutos.'
			};
		}
		throw cause;
	}

	const lines = buildOrderLines(checkout.items, products);
	if (!lines.ok) return { ok: false, status: 400, message: lines.message };

	const { data: folio, error } = await supabaseAdmin.rpc('create_order', {
		p_order: {
			cliente_nombre: checkout.nombre,
			cliente_whatsapp: checkout.whatsapp,
			metodo_entrega: checkout.metodoEntrega,
			direccion: checkout.direccion,
			notas_cliente: checkout.notas,
			subtotal: lines.value.subtotal,
			desc_mayoreo: lines.value.descMayoreo
		},
		p_items: lines.value.items
	});
	if (error || !folio) {
		if (error?.message === 'store_busy') {
			return {
				ok: false,
				status: 429,
				message: 'Estamos recibiendo muchos pedidos. Intenta en un rato o escríbenos por WhatsApp.'
			};
		}
		if (error?.message === 'too_many_orders') {
			return {
				ok: false,
				status: 429,
				message:
					'Ya recibimos varios pedidos de este número. Escríbenos por WhatsApp y te ayudamos.'
			};
		}
		return {
			ok: false,
			status: 503,
			message: 'No pudimos registrar tu pedido. Intenta de nuevo en unos minutos.'
		};
	}

	const message = whatsappMessage(await orderTemplate(), folio, checkout, lines.value);
	const envio = checkout.metodoEntrega === 'recoger' ? 0 : null;
	return {
		ok: true,
		order: {
			folio,
			whatsappUrl: whatsappLink(PUBLIC_WHATSAPP_NUMBER, message),
			lines: lines.value.items.map((item) => ({
				nombre: item.nombre_snapshot,
				detalle: [item.color, item.talla && `Talla ${item.talla}`].filter(Boolean).join(' · '),
				cantidad: item.cantidad,
				importe: (item.precio_unitario + item.recargo_talla) * item.cantidad
			})),
			subtotal: lines.value.subtotal,
			descMayoreo: lines.value.descMayoreo,
			total: lines.value.subtotal - lines.value.descMayoreo + (envio ?? 0),
			porCotizar: envio === null || lines.value.items.some((item) => item.personalizacion_texto)
		}
	};
}
