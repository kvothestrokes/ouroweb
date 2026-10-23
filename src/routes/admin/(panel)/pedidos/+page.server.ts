import { error } from '@sveltejs/kit';
import { STATUSES, type OrderStatus } from '#lib/domain/order-status.js';
import { orderBalance } from '#lib/domain/order-money.js';
import type { PageServerLoad } from './$types';

const LIMIT = 200;

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('admin:pedidos');
	const estado = url.searchParams.get('estado');
	const tipo = url.searchParams.get('tipo');
	// Only letters, digits, spaces and dashes reach the PostgREST filter.
	const q = (url.searchParams.get('q') ?? '')
		.replace(/[^\p{L}\p{N} -]/gu, '')
		.trim()
		.slice(0, 40);

	let query = locals.supabase
		.from('orders')
		.select(
			'id, folio, tipo, estado, cliente_nombre, cliente_whatsapp, metodo_entrega, total, created_at, payments(monto)'
		)
		.order('created_at', { ascending: false })
		.limit(LIMIT);
	if (estado && STATUSES.includes(estado as OrderStatus))
		query = query.eq('estado', estado as OrderStatus);
	if (tipo === 'catalogo' || tipo === 'encargo') query = query.eq('tipo', tipo);
	if (q) {
		const digits = q.replace(/\D/g, '');
		const filters = [`folio.ilike.%${q}%`, `cliente_nombre.ilike.%${q}%`];
		if (digits.length >= 4) filters.push(`cliente_whatsapp.ilike.%${digits}%`);
		query = query.or(filters.join(','));
	}

	const [{ data: orders, error: ordersError }, { data: counts, error: countsError }] =
		await Promise.all([
			query,
			locals.supabase
				.from('orders')
				.select('estado')
				.in('estado', ['pendiente', 'esperando_anticipo'])
		]);
	if (ordersError || countsError) error(500, 'No pudimos cargar los pedidos.');

	return {
		orders: orders.map(({ payments, ...order }) => ({
			...order,
			...orderBalance(order.total, payments)
		})),
		pendientes: counts.filter((row) => row.estado === 'pendiente').length,
		esperandoAnticipo: counts.filter((row) => row.estado === 'esperando_anticipo').length,
		filters: { estado: estado ?? '', tipo: tipo ?? '', q },
		limited: orders.length === LIMIT
	};
};
