import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { cleanText } from '#lib/domain/checkout.js';
import { orderBalance, suggestedDeposit } from '#lib/domain/order-money.js';
import { paymentFromForm, quoteFromForm, templateVariables } from '#lib/domain/order-admin.js';
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
	order_items(id, nombre_snapshot, color, talla, cantidad, precio_unitario, recargo_talla, personalizacion_texto),
	custom_requests(descripcion, cantidad, fecha_deseada, archivos_referencia, precio_final, custom_request_types(nombre, precio_desde)),
	payments(id, tipo, monto, metodo, fecha),
	order_events(id, estado, nota, fecha),
	order_notes(id, texto, fecha),
	order_files(id, imagekit_path, descripcion, created_at)
`;

const thumb = (path: string) => ({
	thumb: signedImageUrl(path, [{ width: 400 }]),
	full: signedImageUrl(path, [{ width: 1600 }])
});

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'Pedido no encontrado');
	const [{ data: order }, { data: settings }] = await Promise.all([
		locals.supabase.from('orders').select(ORDER_SELECT).eq('id', params.id).maybeSingle(),
		locals.supabase
			.from('settings')
			.select('datos_bancarios, direccion_taller, horarios, anticipo_sugerido_pct')
			.single()
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

	const variables = templateVariables({
		order,
		items: order.order_items,
		pagado: balance.pagado,
		settings: settings ?? { datos_bancarios: '', direccion_taller: '', horarios: '' },
		trackingUrl: `${url.origin}/seguimiento?folio=${order.folio}`
	});
	const request = order.custom_requests;

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
	invalid_transition: 'Ese cambio de estado no está permitido desde el estado actual.',
	deposit_required: 'Registra primero el pago del anticipo para confirmar el pedido.',
	payment_exceeds_balance: 'El pago es mayor que el saldo pendiente.',
	order_closed: 'El pedido ya está cerrado.',
	invalid_amount: 'Revisa los montos: no pueden ser negativos.',
	quote_below_paid: 'El nuevo total quedaría por debajo de lo que el cliente ya pagó.',
	deposit_above_total: 'El anticipo no puede ser mayor que el total.',
	discount_above_price: 'El precio del encargo no cubre los descuentos del pedido.',
	request_not_found: 'Este encargo no tiene su descripción; revisa el pedido.'
};

const MAX_FILES = 20;

const mexicoToday = () =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

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
			p_anticipo: nullable(input.value.anticipo)
		});
		if (rpcError) return problem(rpcError.message, 'No pudimos guardar la cotización.');
		return { success: 'Cotización guardada.' };
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
