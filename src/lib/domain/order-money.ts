/** Spec section 7: paid = Σ payments, balance = total − paid. Cents. */
export function orderBalance(total: number, payments: { monto: number }[]) {
	const pagado = payments.reduce((sum, payment) => sum + payment.monto, 0);
	return { pagado, saldo: total - pagado, liquidado: total > 0 && pagado >= total };
}

/** Suggested deposit: `percent` of the total, rounded up to whole pesos. */
export function suggestedDeposit(total: number, percent: number): number {
	return Math.ceil((total * percent) / 100 / 100) * 100;
}

export type InferPaymentTypeInput = {
	monto: number;
	saldo: number;
	pagado?: number;
	anticipoRequerido?: number | null;
	hasAnticipo?: boolean;
};

/**
 * Infers payment type ('anticipo' | 'abono' | 'liquidacion') automatically:
 * - When monto covers or exceeds remaining balance: 'liquidacion'.
 * - When no prior deposit has been registered or covered: 'anticipo'.
 * - When a deposit is already covered and this payment does not liquidate: 'abono'.
 */
export function inferPaymentType(
	input: InferPaymentTypeInput
): 'anticipo' | 'abono' | 'liquidacion' {
	const { monto, saldo, pagado = 0, anticipoRequerido = 0, hasAnticipo } = input;
	if (saldo > 0 && monto >= saldo) {
		return 'liquidacion';
	}
	const alreadyCovered = hasAnticipo ?? (pagado >= (anticipoRequerido ?? 0) && pagado > 0);
	if (!alreadyCovered) {
		return 'anticipo';
	}
	return 'abono';
}
