import { STATUSES, type OrderStatus } from './order-status.js';

const TIME_ZONE = 'America/Mexico_City';
const day = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

/** `YYYY-MM-DD` of a moment in Mexico City. */
const localDay = (date: Date | string) => day.format(new Date(date));

type DashboardOrder = {
	estado: OrderStatus;
	total: number;
	anticipo_requerido: number | null;
	created_at: string;
};

/** Spec F6: orders by status, sales of the month, pending deposits and today's new orders. */
export function dashboardStats(
	orders: DashboardOrder[],
	payments: { monto: number; fecha: string }[],
	now = new Date()
) {
	const today = localDay(now);
	const month = today.slice(0, 7);
	const porEstado = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
		OrderStatus,
		number
	>;
	for (const order of orders) porEstado[order.estado]++;

	const waiting = orders.filter((order) => order.estado === 'esperando_anticipo');
	return {
		porEstado,
		/** Money received this month (payments), in cents. */
		ventasMes: payments
			.filter((payment) => localDay(payment.fecha).startsWith(month))
			.reduce((sum, payment) => sum + payment.monto, 0),
		pedidosMes: orders.filter(
			(order) => order.estado !== 'cancelado' && localDay(order.created_at).startsWith(month)
		).length,
		anticiposPendientes: {
			pedidos: waiting.length,
			monto: waiting.reduce((sum, order) => sum + (order.anticipo_requerido ?? 0), 0)
		},
		nuevosHoy: orders.filter((order) => localDay(order.created_at) === today).length
	};
}
