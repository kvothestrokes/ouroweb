/**
 * Mexican WhatsApp number as typed by a customer (10 national digits, optionally with
 * +52, spaces or dashes) to the stored form `52XXXXXXXXXX`. Null when it is not valid.
 */
export function normalizeMxPhone(value: string): string | null {
	const digits = value.replace(/[\s\-().]/g, '').replace(/^\+/, '');
	if (/^\d{10}$/.test(digits)) return `52${digits}`;
	if (/^52\d{10}$/.test(digits)) return digits;
	return null;
}

/** Used by order tracking (folio + last 4 digits). */
export function lastFourDigits(phone: string): string {
	return phone.slice(-4);
}
