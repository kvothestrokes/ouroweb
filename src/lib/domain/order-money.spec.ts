import { describe, expect, it } from 'vitest';
import { inferPaymentType, orderBalance, suggestedDeposit } from './order-money.js';

describe('orderBalance', () => {
	it('sums payments and leaves the rest as balance', () => {
		expect(orderBalance(85000, [{ monto: 40000 }, { monto: 5000 }])).toEqual({
			pagado: 45000,
			saldo: 40000,
			liquidado: false
		});
		expect(orderBalance(85000, [{ monto: 85000 }]).liquidado).toBe(true);
	});
});

describe('suggestedDeposit', () => {
	it('suggests the percentage rounded up to whole pesos', () => {
		expect(suggestedDeposit(85050, 50)).toBe(42600);
		expect(suggestedDeposit(0, 50)).toBe(0);
	});
});

describe('inferPaymentType', () => {
	it('infers liquidacion when payment covers or exceeds balance', () => {
		expect(inferPaymentType({ monto: 50000, saldo: 50000, pagado: 0 })).toBe('liquidacion');
		expect(inferPaymentType({ monto: 60000, saldo: 50000, pagado: 0 })).toBe('liquidacion');
		expect(
			inferPaymentType({
				monto: 25000,
				saldo: 25000,
				pagado: 25000,
				hasAnticipo: true
			})
		).toBe('liquidacion');
	});

	it('infers anticipo when no deposit has been covered', () => {
		expect(
			inferPaymentType({
				monto: 25000,
				saldo: 50000,
				pagado: 0,
				anticipoRequerido: 25000
			})
		).toBe('anticipo');
		// Partial payment under deposit
		expect(
			inferPaymentType({
				monto: 10000,
				saldo: 50000,
				pagado: 0,
				anticipoRequerido: 25000
			})
		).toBe('anticipo');
		// Deposit required is unset/null
		expect(
			inferPaymentType({
				monto: 20000,
				saldo: 50000,
				pagado: 0,
				anticipoRequerido: null
			})
		).toBe('anticipo');
	});

	it('infers abono when deposit was already covered and payment does not liquidate', () => {
		expect(
			inferPaymentType({
				monto: 10000,
				saldo: 30000,
				pagado: 20000,
				anticipoRequerido: 20000,
				hasAnticipo: true
			})
		).toBe('abono');
		expect(
			inferPaymentType({
				monto: 5000,
				saldo: 25000,
				pagado: 25000,
				anticipoRequerido: 25000
			})
		).toBe('abono');
	});
});
