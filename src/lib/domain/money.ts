const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Cents (integer) to `$1,200.50`. All amounts are stored as integer cents. */
export function formatMoney(cents: number): string {
	return formatter.format(cents / 100);
}

const AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Pesos typed by the admin (`170`, `170.5`, `$1,200.00`) to cents.
 * Empty → null ("not defined yet"); anything else that is not an amount → NaN.
 */
export function parseMoney(value: FormDataEntryValue | string | null): number | null {
	if (typeof value !== 'string') return null;
	const clean = value.trim().replace(/^\$/, '').replace(/,/g, '').trim();
	if (clean === '') return null;
	const match = AMOUNT.exec(clean);
	if (!match) return NaN;
	const [, pesos, decimals = ''] = match;
	return Number(pesos) * 100 + Number(decimals.padEnd(2, '0'));
}

/** Cents back to an input value: `17050` → `170.5`, null → empty. */
export function centsToInput(cents: number | null): string {
	return cents === null ? '' : String(cents / 100);
}
