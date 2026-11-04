import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { dedupeCustomers, manualOrderFromForm } from '#lib/domain/order-admin.js';
import { supabaseAdmin } from '#lib/server/supabase-admin.js';
import type { Actions, PageServerLoad } from './$types';

const MESSAGES: Record<string, string> = {
	address_required: 'Completa la dirección de entrega.',
	deposit_required:
		'Para crear el pedido como Confirmado, registra un pago inicial de tipo Anticipo.',
	payment_exceeds_balance: 'El pago inicial no puede ser mayor que el total del pedido.',
	invalid_amount: 'Revisa los montos y cantidades del pedido.',
	discount_above_price: 'Los descuentos superan el subtotal del pedido.',
	deposit_above_total: 'El anticipo requerido no puede ser mayor que el total.',
	request_not_found: 'Completa la descripción y cantidad del encargo.'
};

function todayIso(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export const load: PageServerLoad = async ({ locals }) => {
	const [
		{ data: products, error: productsError },
		{ data: requestTypes, error: typesError },
		{ data: recentOrders },
		{ data: settings }
	] = await Promise.all([
		locals.supabase
			.from('products')
			.select(
				`id, nombre, activo, precio_base, precio_oferta, oferta_hasta, permite_personalizar,
				garment_types(nombre, tallas, recargos_talla, precio_normal),
				product_colors(garment_bases(color_nombre))`
			)
			.order('nombre'),
		locals.supabase
			.from('custom_request_types')
			.select('id, nombre, precio_desde, activo')
			.order('nombre'),
		locals.supabase
			.from('orders')
			.select('cliente_nombre, cliente_whatsapp, metodo_entrega, direccion')
			.order('created_at', { ascending: false })
			.limit(150),
		locals.supabase.from('settings').select('anticipo_sugerido_pct').maybeSingle()
	]);

	if (productsError || typesError) {
		error(500, 'No pudimos cargar el catálogo para crear el pedido.');
	}

	const today = todayIso();
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
			colores,
			permite_personalizar: product.permite_personalizar
		};
	});

	return {
		catalogProducts,
		requestTypes: requestTypes ?? [],
		customers: dedupeCustomers(recentOrders ?? []),
		suggestedPct: settings?.anticipo_sugerido_pct ?? 50
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const admin = await locals.getAdmin();
		if (!admin) error(403, 'No autorizado');

		const parsed = manualOrderFromForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const value = parsed.value;
		const { data, error: rpcError } = await supabaseAdmin.rpc('admin_create_order', {
			p_order: {
				tipo: value.tipo,
				estado: value.estado,
				cliente_nombre: value.details.cliente_nombre,
				cliente_whatsapp: value.details.cliente_whatsapp,
				metodo_entrega: value.details.metodo_entrega,
				direccion: value.details.direccion,
				notas_cliente: value.details.notas_cliente,
				desc_mayoreo: value.desc_mayoreo,
				desc_cupon: value.desc_cupon,
				personalizacion: value.personalizacion,
				envio: value.envio,
				anticipo_requerido: value.anticipo_requerido
			},
			p_items: value.items,
			p_request: value.request,
			p_payment: value.initialPayment
		});

		if (rpcError || !data || typeof data !== 'object' || Array.isArray(data)) {
			const msg =
				(rpcError?.message && MESSAGES[rpcError.message]) ??
				'No pudimos crear el pedido. Revisa los datos e intenta de nuevo.';
			return fail(400, { message: msg });
		}

		const created = data as { id?: string; folio?: string };
		if (!created.id) {
			return fail(500, { message: 'El pedido se creó pero no pudimos abrir su detalle.' });
		}

		redirect(303, resolve('/admin/(panel)/pedidos/[id]', { id: created.id }));
	}
} satisfies Actions;
