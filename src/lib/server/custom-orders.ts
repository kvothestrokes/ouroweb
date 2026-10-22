import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
import { deliveryLabel, type Contact } from '#lib/domain/checkout.js';
import { MAX_REFERENCE_IMAGES, type CustomRequestInput } from '#lib/domain/custom-request.js';
import { formatMoney } from '#lib/domain/money.js';
import { renderTemplate, whatsappLink } from '#lib/domain/whatsapp.js';
import { uploadImage } from './imagekit.js';
import { prepareReference } from './reference-images.js';
import { StoreUnavailableError, loadCustomRequestTypes } from './store.js';
import { supabaseAdmin } from './supabase-admin.js';

export type PlacedRequest = { folio: string; whatsappUrl: string; referencias: number };

export type CustomOrderResult =
	{ ok: true; order: PlacedRequest } | { ok: false; status: 400 | 429 | 503; message: string };

const FALLBACK_TEMPLATE = `¡Hola, Ouroboros! 🐍✨
Acabo de enviar mi encargo especial *{{folio}}*

👤 {{nombre}}
📦 Entrega: {{metodo_entrega}}

{{resumen}}

Quedo pendiente de la cotización. ¡Gracias!`;

const UNAVAILABLE = 'No pudimos registrar tu encargo. Intenta de nuevo en unos minutos.';

function formatDate(date: string): string {
	return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`)
	);
}

/** Spec 6.2: validates references, creates the "encargo" order and stores its images. */
export async function placeCustomOrder(
	request: CustomRequestInput,
	contact: Contact,
	files: File[]
): Promise<CustomOrderResult> {
	if (files.length > MAX_REFERENCE_IMAGES) {
		return {
			ok: false,
			status: 400,
			message: `Puedes subir hasta ${MAX_REFERENCE_IMAGES} imágenes.`
		};
	}

	let types;
	try {
		types = await loadCustomRequestTypes();
	} catch (cause) {
		if (cause instanceof StoreUnavailableError)
			return { ok: false, status: 503, message: UNAVAILABLE };
		throw cause;
	}
	const type = types.find((item) => item.id === request.custom_request_type_id) ?? null;
	if (request.custom_request_type_id && !type) {
		return {
			ok: false,
			status: 400,
			message: 'Ese tipo de encargo ya no está disponible. Elige otro.'
		};
	}

	// Validate every image before creating the order, so a bad file never leaves an order behind.
	const images: Buffer[] = [];
	for (const file of files) {
		const prepared = await prepareReference(file);
		if (!prepared.ok) return { ok: false, status: 400, message: prepared.message };
		images.push(prepared.bytes);
	}

	const { data: folio, error } = await supabaseAdmin.rpc('create_custom_order', {
		p_order: {
			cliente_nombre: contact.nombre,
			cliente_whatsapp: contact.whatsapp,
			metodo_entrega: contact.metodoEntrega,
			direccion: contact.direccion,
			notas_cliente: ''
		},
		p_request: request
	});
	if (error || !folio) {
		if (error?.message === 'too_many_orders' || error?.message === 'store_busy') {
			return {
				ok: false,
				status: 429,
				message: 'Recibimos varios encargos seguidos. Escríbenos por WhatsApp y te ayudamos.'
			};
		}
		return { ok: false, status: 503, message: UNAVAILABLE };
	}

	// The order exists already: a failed upload only means fewer references in the panel.
	const paths: string[] = [];
	for (const [i, bytes] of images.entries()) {
		try {
			paths.push(
				await uploadImage(
					new File([new Uint8Array(bytes)], `referencia-${i + 1}.webp`, { type: 'image/webp' }),
					'orders',
					folio
				)
			);
		} catch {
			// Reported below through the count of stored references.
		}
	}
	if (paths.length) {
		const { data: order } = await supabaseAdmin
			.from('orders')
			.select('id')
			.eq('folio', folio)
			.single();
		if (order) {
			await supabaseAdmin
				.from('custom_requests')
				.update({ archivos_referencia: paths })
				.eq('order_id', order.id);
		}
	}

	const { data: template } = await supabaseAdmin
		.from('wa_templates')
		.select('cuerpo')
		.eq('clave', 'encargo_nuevo')
		.maybeSingle();
	const resumen = [
		`🎨 ${type ? type.nombre : 'Encargo especial'}${type?.precio_desde != null ? ` (desde ${formatMoney(type.precio_desde)})` : ''}`,
		`Cantidad: ${request.cantidad}`,
		request.fecha_deseada ? `Lo necesito para: ${formatDate(request.fecha_deseada)}` : null,
		`\n${request.descripcion}`,
		paths.length
			? `\n📎 Subí ${paths.length} ${paths.length === 1 ? 'imagen' : 'imágenes'} de referencia.`
			: files.length
				? '\n📎 Te mando mis imágenes de referencia por aquí.'
				: null
	]
		.filter(Boolean)
		.join('\n');
	const message = renderTemplate(template?.cuerpo ?? FALLBACK_TEMPLATE, {
		folio,
		nombre: contact.nombre,
		metodo_entrega: deliveryLabel(contact.metodoEntrega),
		resumen
	});

	return {
		ok: true,
		order: {
			folio,
			whatsappUrl: whatsappLink(PUBLIC_WHATSAPP_NUMBER, message),
			referencias: paths.length
		}
	};
}
