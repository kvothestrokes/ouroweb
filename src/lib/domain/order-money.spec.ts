import { describe, expect, it } from 'vitest';
import { orderBalance, suggestedDeposit } from './order-money.js';

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
