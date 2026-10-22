import { describe, expect, it } from 'vitest';
import { dashboardStats } from './dashboard.js';

const now = new Date('2026-10-22T20:00:00Z'); // 14:00 in Mexico City

describe('dashboardStats', () => {
	it('summarizes orders by status, month sales, pending deposits and today', () => {
		const stats = dashboardStats(
			[
				{
					estado: 'pendiente',
					total: 17000,
					anticipo_requerido: null,
					created_at: '2026-10-22T15:00:00Z'
				},
				{
					estado: 'esperando_anticipo',
					total: 50000,
					anticipo_requerido: 25000,
					created_at: '2026-10-20T15:00:00Z'
				},
				{
					estado: 'esperando_anticipo',
					total: 30000,
					anticipo_requerido: null,
					created_at: '2026-10-19T15:00:00Z'
				},
				{
					estado: 'entregado',
					total: 34000,
					anticipo_requerido: 17000,
					created_at: '2026-09-30T15:00:00Z'
				},
				{
					estado: 'cancelado',
					total: 9000,
					anticipo_requerido: null,
					created_at: '2026-10-22T16:00:00Z'
				},
				// 23:30 on Oct 21 in Mexico City is still "yesterday" there.
				{
					estado: 'pendiente',
					total: 5000,
					anticipo_requerido: null,
					created_at: '2026-10-22T05:30:00Z'
				}
			],
			[
				{ monto: 17000, fecha: '2026-10-01T18:00:00Z' },
				{ monto: 10000, fecha: '2026-09-30T18:00:00Z' },
				// 1 Oct 01:00 UTC is still 30 Sep in Mexico City.
				{ monto: 5000, fecha: '2026-10-01T01:00:00Z' }
			],
			now
		);
		expect(stats.porEstado.pendiente).toBe(2);
		expect(stats.porEstado.esperando_anticipo).toBe(2);
		expect(stats.porEstado.entregado).toBe(1);
		expect(stats.ventasMes).toBe(17000);
		expect(stats.pedidosMes).toBe(4);
		expect(stats.anticiposPendientes).toEqual({ pedidos: 2, monto: 25000 });
		expect(stats.nuevosHoy).toBe(2);
	});
});
