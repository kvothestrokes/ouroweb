import { timingSafeEqual } from 'node:crypto';
import { orderBalance } from '#lib/domain/order-money.js';
import type { OrderStatus } from '#lib/domain/order-status.js';
import { allowDurable } from './durable-rate-limit.js';
import { deleteImageByPath, uploadImage } from './imagekit.js';
import { prepareReference } from './reference-images.js';
import { supabaseAdmin } from './supabase-admin.js';

export const NOT_FOUND = 'No encontramos un pedido con esos datos. Revisa el folio y los dígitos.';
export const TOO_MANY = 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';

/** What the customer sees: no phone, no address, no internal notes. */
export type TrackingView = {
	folio: string;
	tipo: 'catalogo' | 'encargo';
	estado: OrderStatus;
	nombre: string;
	metodoEntrega: 'recoger' | 'domicilio' | 'paqueteria';
	guia: string | null;
	creado: string;
	eventos: { estado: OrderStatus; fecha: string }[];
	lineas: { nombre: string; detalle: string; cantidad: number; importe: number }[];
	encargo: string | null;
	total: number;
	pagado: number;
	saldo: number;
	porCotizar: boolean;
	puedeResenar: boolean;
	resenaEnviada: boolean;
};

function sameDigits(phone: string, digits: string): boolean {
	return timingSafeEqual(
		Buffer.from(phone.slice(-4)),
		Buffer.from(digits.padStart(4, '0').slice(0, 4))
	);
}

/** Both limits fail closed: guessing 4 digits must stay expensive. */
export async function allowTracking(ip: string, folio: string): Promise<boolean> {
	const [byIp, byFolio] = await Promise.all([
		allowDurable(`seguimiento:ip:${ip}`, { limit: 15, windowSeconds: 900, failOpen: false }),
		allowDurable(`seguimiento:folio:${folio}`, { limit: 8, windowSeconds: 3600, failOpen: false })
	]);
	return byIp && byFolio;
}

async function loadOrder(folio: string) {
	const { data } = await supabaseAdmin
		.from('orders')
		.select(
			`id, folio, tipo, estado, cliente_nombre, cliente_whatsapp, metodo_entrega, guia, created_at,
			subtotal, envio, personalizacion, total,
			order_items(product_id, nombre_snapshot, color, talla, cantidad, precio_unitario, recargo_talla, personalizacion_texto),
			custom_requests(descripcion, precio_final),
			payments(monto), order_events(estado, fecha), reviews(id)`
		)
		.eq('folio', folio)
		.maybeSingle();
	return data;
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

/** The order when folio and digits match; null otherwise (same answer for both cases). */
export async function findTrackedOrder(folio: string, digits: string): Promise<LoadedOrder | null> {
	const order = await loadOrder(folio);
	// Compare even when the folio does not exist, so timing does not tell them apart.
	const phone = order?.cliente_whatsapp ?? '520000000000';
	const match = sameDigits(phone, digits);
	return order && match ? order : null;
}

export function trackingView(order: LoadedOrder): TrackingView {
	const { pagado, saldo } = orderBalance(order.total, order.payments);
	const hasCustomization = order.order_items.some((item) => item.personalizacion_texto);
	return {
		folio: order.folio,
		tipo: order.tipo,
		estado: order.estado,
		nombre: order.cliente_nombre.split(' ')[0],
		metodoEntrega: order.metodo_entrega,
		guia: order.guia,
		creado: order.created_at,
		eventos: [...order.order_events]
			.sort((a, b) => a.fecha.localeCompare(b.fecha))
			.map(({ estado, fecha }) => ({ estado, fecha })),
		lineas: order.order_items.map((item) => ({
			nombre: item.nombre_snapshot,
			detalle: [item.color, item.talla && `Talla ${item.talla}`].filter(Boolean).join(' · '),
			cantidad: item.cantidad,
			importe: (item.precio_unitario + item.recargo_talla) * item.cantidad
		})),
		encargo: order.custom_requests?.descripcion ?? null,
		total: order.total,
		pagado,
		saldo,
		porCotizar:
			order.envio === null ||
			(order.tipo === 'encargo' && order.custom_requests?.precio_final == null) ||
			(hasCustomization && order.personalizacion === null),
		puedeResenar: order.estado === 'entregado' && order.reviews.length === 0,
		resenaEnviada: order.reviews.length > 0
	};
}

/** Saves a review (waiting for approval), with an optional photo kept private until then. */
export async function submitReview(
	order: LoadedOrder,
	review: { calificacion: number; texto: string },
	photo: File | null
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (order.estado !== 'entregado' || order.reviews.length) {
		return { ok: false, message: 'Este pedido ya no puede recibir reseñas.' };
	}
	let fotoPath: string | null = null;
	if (photo) {
		const prepared = await prepareReference(photo);
		if (!prepared.ok) return prepared;
		try {
			fotoPath = await uploadImage(
				new File([new Uint8Array(prepared.bytes)], 'resena.webp', { type: 'image/webp' }),
				'orders',
				order.folio
			);
		} catch {
			return { ok: false, message: 'No pudimos subir tu foto. Intenta de nuevo.' };
		}
	}
	const { error } = await supabaseAdmin.from('reviews').insert({
		order_id: order.id,
		product_id: order.order_items.find((item) => item.product_id)?.product_id ?? null,
		calificacion: review.calificacion,
		texto: review.texto,
		foto_path: fotoPath
	});
	if (error) {
		if (fotoPath) await deleteImageByPath(fotoPath);
		return {
			ok: false,
			message:
				error.code === '23505'
					? 'Ya recibimos tu reseña. ¡Gracias!'
					: 'No pudimos guardar tu reseña.'
		};
	}
	return { ok: true };
}
