import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { cleanText } from '#lib/domain/checkout.js';
import { orderBalance, suggestedDeposit } from '#lib/domain/order-money.js';
import {
	adminCustomRequestFromForm,
	orderDetailsFromForm,
	orderLinesFromForm,
	overrideStatuses,
	paymentFromForm,
	quoteFromForm,
	statusOverrideFromForm,
	templateVariables
} from '#lib/domain/order-admin.js';
import {
	STATUSES,
	nextStatuses,
	templateForStatus,
	type OrderStatus
} from '#lib/domain/order-status.js';
import { renderTemplate, whatsappLink } from '#lib/domain/whatsapp.js';
import { deleteImageByPath, signedImageUrl, uploadImage } from '#lib/server/imagekit.js';
import { prepareReference } from '#lib/server/reference-images.js';
import type { Actions, PageServerLoad } from './$types';

const ORDER_SELECT = `
	id, folio, tipo, estado, cliente_nombre, cliente_whatsapp, metodo_entrega, direccion,
	notas_cliente, subtotal, desc_mayoreo, desc_cupon, personalizacion, envio, total,
	anticipo_requerido, guia, created_at,
	order_items(id, product_id, nombre_snapshot, color, talla, cantidad, precio_unitario, recargo_talla, personalizacion_texto),
	custom_requests(custom_request_type_id, descripcion, cantidad, fecha_deseada, archivos_referencia, precio_final, custom_request_types(nombre, precio_desde)),
	payments(id, tipo, monto, metodo, fecha),
	order_events(id, estado, nota, fecha),
	order_notes(id, texto, fecha),
	order_files(id, imagekit_path, descripcion, created_at)
`;

const thumb = (path: string) => ({
	thumb: signedImageUrl(path, [{ width: 400 }]),
	full: signedImageUrl(path, [{ width: 1600 }])
});

const mexicoToday = () =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'Pedido no encontrado');
	const [{ data: order }, { data: settings }, { data: products }, { data: requestTypes }] =
		await Promise.all([
			locals.supabase.from('orders').select(ORDER_SELECT).eq('id', params.id).maybeSingle(),
			locals.supabase
				.from('settings')
				.select('datos_bancarios, direccion_taller, horarios, anticipo_sugerido_pct')
				.single(),
			locals.supabase
				.from('products')
				.select(
					`id, nombre, activo, precio_base, precio_oferta, oferta_hasta,
					garment_types(nombre, tallas, recargos_talla, precio_normal),
					product_colors(garment_bases(color_nombre))`
				)
				.order('nombre'),
			locals.supabase
				.from('custom_request_types')
				.select('id, nombre, precio_desde, activo')
				.order('nombre')
		]);
	if (!order) error(404, 'Pedido no encontrado');

	const balance = orderBalance(order.total, order.payments);
	const template = templateForStatus(order.estado);
	const { data: templateRow } = template
		? await locals.supabase
				.from('wa_templates')
				.select('nombre, cuerpo')
				.eq('clave', template)
				.maybeSingle()
		: { data: null };

	const trackingUrl = `${url.origin}/seguimiento?folio=${order.folio}`;
	const variables = templateVariables({
		order,
		items: order.order_items,
		pagado: balance.pagado,
		settings: settings ?? { datos_bancarios: '', direccion_taller: '', horarios: '' },
		trackingUrl
	});
	const request = order.custom_requests;
	const today = mexicoToday();

	const catalogProducts = (products ?? []).map((product) => {
		const gt = product.garment_types;
		const basePrice = product.precio_base ?? gt?.precio_normal ?? 0;
		const hasActiveOffer =
			product.precio_oferta !== null && (!product.oferta_hasta || product.oferta_hasta >= today);
		const unitPrice = hasActiveOffer ? (product.precio_oferta ?? basePrice) : basePrice;
		const recargosRaw =
			gt?.recargos_talla &&
			typeof gt.recargos_talla === 'object' &&
			!Array.isArray(gt.recargos_talla)
				? (gt.recargos_talla as Record<string, number>)
				: {};
		const colores = (product.product_colors ?? [])
			.map((row) => row.garment_bases?.color_nombre)
			.filter((name): name is string => Boolean(name));

		return {
			id: product.id,
			nombre: product.nombre,
			activo: product.activo,
			prenda: gt?.nombre ?? null,
			precio_unitario: unitPrice,
			tallas: gt?.tallas ?? [],
			recargos: recargosRaw,
			colores
		};
	});

	return {
		order: {
			...order,
			order_events: [...order.order_events].sort((a, b) => a.fecha.localeCompare(b.fecha)),
			order_notes: [...order.order_notes].sort((a, b) => b.fecha.localeCompare(a.fecha)),
			payments: [...order.payments].sort((a, b) => a.fecha.localeCompare(b.fecha)),
			order_files: order.order_files.map((file) => ({ ...file, ...thumb(file.imagekit_path) }))
		},
		request: request ? { ...request, referencias: request.archivos_referencia.map(thumb) } : null,
		balance,
		suggestedDeposit: suggestedDeposit(order.total, settings?.anticipo_sugerido_pct ?? 50),
		next: nextStatuses(order.estado, order.metodo_entrega),
		overrideStatuses: overrideStatuses(order.estado, order.metodo_entrega),
		trackingUrl,
		whatsappSummary: variables.resumen,
		catalogProducts,
		requestTypes: requestTypes ?? [],
		notify: templateRow
			? {
					nombre: templateRow.nombre,
					href: whatsappLink(order.cliente_whatsapp, renderTemplate(templateRow.cuerpo, variables))
				}
			: null,
		chatHref: whatsappLink(order.cliente_whatsapp)
	};
};

/** Postgres errors from the order functions, as messages for the admin. */
const MESSAGES: Record<string, string> = {
	invalid_transition: 'Ese cambio de estado no está permitido para este pedido.',
	deposit_required:
		'Este estado requiere que el pedido tenga al menos un pago registrado de tipo anticipo.',
	payment_exceeds_balance: 'El pago es mayor que el saldo pendiente.',
	order_closed:
		'El pedido está cerrado (entregado o cancelado). Reabre su estado primero si necesitas modificarlo.',
	invalid_amount: 'Revisa los montos y cantidades: no pueden ser negativos.',
	quote_below_paid: 'El nuevo total quedaría por debajo de lo que el cliente ya pagó.',
	deposit_above_total: 'El anticipo no puede ser mayor que el total.',
	discount_above_price: 'Los descuentos superan el subtotal del pedido.',
	request_not_found: 'Este encargo no tiene su descripción; revisa el pedido.',
	address_required: 'Completa la dirección de entrega.',
	invalid_contact: 'Revisa el nombre y el WhatsApp del cliente.',
	note_required: 'Escribe el motivo de la corrección de estado.',
	payment_not_found: 'No encontramos ese pago en el pedido.'
};

const MAX_FILES = 20;

function problem(message: string | undefined, fallback: string) {
	return fail(400, { message: (message && MESSAGES[message]) ?? fallback });
}

export const actions = {
	cotizar: async ({ request, locals, params }) => {
		const input = quoteFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		// Generated RPC types cannot say an argument is nullable; null means "por cotizar".
		const nullable = (cents: number | null) => cents as number;
		const { error: rpcError } = await locals.supabase.rpc('quote_order', {
			p_order_id: params.id,
			p_envio: nullable(input.value.envio),
			p_personalizacion: nullable(input.value.personalizacion),
			p_precio_final: nullable(input.value.precio_final),
			p_anticipo: nullable(input.value.anticipo),
			p_desc_mayoreo: input.value.desc_mayoreo ?? undefined,
			p_desc_cupon: input.value.desc_cupon ?? undefined
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos guardar la cotización.');
		return { success: 'Cotización y descuentos guardados.' };
	},

	datos: async ({ request, locals, params }) => {
		const input = orderDetailsFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { error: rpcError } = await locals.supabase.rpc('admin_update_order_details', {
			p_order_id: params.id,
			p_cliente_nombre: input.value.cliente_nombre,
			p_cliente_whatsapp: input.value.cliente_whatsapp,
			p_metodo_entrega: input.value.metodo_entrega,
			p_direccion: input.value.direccion,
			p_notas_cliente: input.value.notas_cliente,
			p_guia: input.value.guia
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos guardar los datos del cliente.');
		return { success: 'Datos del cliente y entrega actualizados.' };
	},

	partidas: async ({ request, locals, params }) => {
		const input = orderLinesFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { error: rpcError } = await locals.supabase.rpc('admin_save_order_items', {
			p_order_id: params.id,
			p_items: input.value.items,
			p_desc_mayoreo: input.value.desc_mayoreo ?? undefined
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos actualizar las partidas.');
		return { success: 'Partidas y subtotal actualizados.' };
	},

	encargo: async ({ request, locals, params }) => {
		const input = adminCustomRequestFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { error: rpcError } = await locals.supabase.rpc('admin_update_custom_request', {
			p_order_id: params.id,
			p_custom_request_type_id: input.value.custom_request_type_id,
			p_descripcion: input.value.descripcion,
			p_cantidad: input.value.cantidad,
			p_fecha_deseada: input.value.fecha_deseada
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos actualizar los datos del encargo.');
		return { success: 'Detalles del encargo actualizados.' };
	},

	pago: async ({ request, locals, params }) => {
		const input = paymentFromForm(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { error: rpcError } = await locals.supabase.rpc('add_payment', {
			p_order_id: params.id,
			p_tipo: input.value.tipo,
			p_monto: input.value.monto,
			p_metodo: input.value.metodo,
			// A payment dated today keeps the real time; earlier dates are recorded at midday.
			p_fecha: input.value.fecha?.startsWith(mexicoToday())
				? undefined
				: (input.value.fecha ?? undefined)
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos registrar el pago.');
		return { success: 'Pago registrado.' };
	},

	eliminarPago: async ({ request, locals, params }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Pago no válido.' });
		const { error: rpcError } = await locals.supabase.rpc('admin_delete_payment', {
			p_order_id: params.id,
			p_payment_id: id
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos eliminar el pago.');
		return { success: 'Pago eliminado.' };
	},

	estado: async ({ request, locals, params }) => {
		const form = await request.formData();
		const estado = form.get('estado');
		if (typeof estado !== 'string' || !STATUSES.includes(estado as OrderStatus)) {
			return fail(400, { message: 'Elige el nuevo estado.' });
		}
		const nota = cleanText(String(form.get('nota') ?? '')).slice(0, 300);
		const { error: rpcError } = await locals.supabase.rpc('change_order_status', {
			p_order_id: params.id,
			p_estado: estado as OrderStatus,
			p_nota: nota || undefined
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos cambiar el estado.');
		return { success: 'Estado actualizado. Ahora avísale al cliente por WhatsApp.' };
	},

	revertirEstado: async ({ request, locals, params }) => {
		const form = await request.formData();
		const { data: current } = await locals.supabase
			.from('orders')
			.select('estado, metodo_entrega')
			.eq('id', params.id)
			.maybeSingle();
		if (!current) return fail(404, { message: 'Pedido no encontrado.' });

		const parsed = statusOverrideFromForm(form, current.estado, current.metodo_entrega);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const { error: rpcError } = await locals.supabase.rpc('admin_override_order_status', {
			p_order_id: params.id,
			p_estado: parsed.value.estado,
			p_nota: parsed.value.nota
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos corregir el estado del pedido.');
		return { success: 'Estado corregido y registrado en el historial.' };
	},

	guia: async ({ request, locals, params }) => {
		const guia = cleanText(String((await request.formData()).get('guia') ?? '')).slice(0, 80);
		const { data: updated, error: updateError } = await locals.supabase
			.from('orders')
			.update({ guia: guia || null })
			.eq('id', params.id)
			.not('estado', 'in', '(entregado,cancelado)')
			.select('id')
			.maybeSingle();
		if (updateError || !updated) return fail(400, { message: 'No pudimos guardar la guía.' });
		return { success: 'Guía guardada.' };
	},

	nota: async ({ request, locals, params }) => {
		const texto = cleanText(String((await request.formData()).get('texto') ?? ''), true).slice(
			0,
			1000
		);
		if (!texto) return fail(400, { message: 'Escribe la nota.' });
		const { error: insertError } = await locals.supabase
			.from('order_notes')
			.insert({ order_id: params.id, texto });
		if (insertError) return fail(400, { message: 'No pudimos guardar la nota.' });
		return { success: 'Nota agregada.' };
	},

	eliminarNota: async ({ request, locals, params }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Nota no válida.' });
		const { error: deleteError } = await locals.supabase
			.from('order_notes')
			.delete()
			.eq('id', id)
			.eq('order_id', params.id);
		if (deleteError) return fail(400, { message: 'No pudimos eliminar la nota.' });
		return { success: 'Nota eliminada.' };
	},

	archivo: async ({ request, locals, params }) => {
		const form = await request.formData();
		const file = form.get('archivo');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { message: 'Elige una imagen.' });
		const { data: order } = await locals.supabase
			.from('orders')
			.select('folio')
			.eq('id', params.id)
			.maybeSingle();
		if (!order) return fail(404, { message: 'Pedido no encontrado.' });
		const { count } = await locals.supabase
			.from('order_files')
			.select('id', { count: 'exact', head: true })
			.eq('order_id', params.id);
		if ((count ?? 0) >= MAX_FILES) {
			return fail(400, {
				message: `Cada pedido guarda hasta ${MAX_FILES} imágenes. Borra alguna primero.`
			});
		}

		const prepared = await prepareReference(file);
		if (!prepared.ok) return fail(400, { message: prepared.message });
		let path: string;
		try {
			path = await uploadImage(
				new File([new Uint8Array(prepared.bytes)], 'archivo.webp', { type: 'image/webp' }),
				'orders',
				order.folio
			);
		} catch {
			return fail(503, { message: 'No pudimos subir la imagen. Intenta de nuevo.' });
		}
		const descripcion = cleanText(String(form.get('descripcion') ?? '')).slice(0, 120);
		const { error: insertError } = await locals.supabase
			.from('order_files')
			.insert({ order_id: params.id, imagekit_path: path, descripcion: descripcion || null });
		if (insertError) {
			await deleteImageByPath(path);
			return fail(400, { message: 'No pudimos guardar la imagen.' });
		}
		return { success: 'Imagen agregada.' };
	},

	eliminarArchivo: async ({ request, locals, params }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Revisa el archivo.' });
		const { data: file } = await locals.supabase
			.from('order_files')
			.delete()
			.eq('id', id)
			.eq('order_id', params.id)
			.select('imagekit_path')
			.maybeSingle();
		if (!file) return fail(400, { message: 'No pudimos eliminar la imagen.' });
		await deleteImageByPath(file.imagekit_path);
		return { success: 'Imagen eliminada.' };
	}
} satisfies Actions;
