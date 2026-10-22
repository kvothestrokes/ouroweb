/** Spec section 7: paid = Σ payments, balance = total − paid. Cents. */
export function orderBalance(total: number, payments: { monto: number }[]) {
	const pagado = payments.reduce((sum, payment) => sum + payment.monto, 0);
	return { pagado, saldo: total - pagado, liquidado: total > 0 && pagado >= total };
}

/** Suggested deposit: `percent` of the total, rounded up to whole pesos. */
export function suggestedDeposit(total: number, percent: number): number {
	return Math.ceil((total * percent) / 100 / 100) * 100;
}
