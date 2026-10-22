import { error } from '@sveltejs/kit';
import { dashboardStats } from '#lib/domain/dashboard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('admin:pedidos');
	// Payments from the last ~40 days cover the current month in any time zone.
	const since = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
	const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }] =
		await Promise.all([
			locals.supabase
				.from('orders')
				.select('id, folio, cliente_nombre, estado, total, anticipo_requerido, created_at')
				.order('created_at', { ascending: false }),
			locals.supabase.from('payments').select('monto, fecha').gte('fecha', since)
		]);
	if (ordersError || paymentsError) error(500, 'No pudimos cargar el resumen.');

	return {
		stats: dashboardStats(orders, payments),
		recientes: orders.filter((order) => order.estado === 'pendiente').slice(0, 5)
	};
};
