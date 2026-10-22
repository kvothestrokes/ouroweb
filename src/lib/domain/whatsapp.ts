import { formatMoney } from './money.js';

/** `https://wa.me/<number>?text=<message>` (CLAUDE.md, "Dominio clave"). */
export function whatsappLink(number: string, message?: string): string {
	const base = `https://wa.me/${number}`;
	return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Replaces `{{variable}}`; unknown or empty variables become empty, never literal braces. */
export function renderTemplate(body: string, variables: Record<string, string>): string {
	return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name: string) =>
		Object.hasOwn(variables, name) ? variables[name] : ''
	);
}

export type SummaryItem = {
	cantidad: number;
	nombre: string;
	color: string | null;
	talla: string | null;
	/** Line amount in cents. */
	importe: number;
	personalizacion: string | null;
};

/** `• 2× Playera Akatsuki · Negro · M — $560.00` (spec section 8). */
export function summaryLine(item: SummaryItem): string {
	const name = [item.nombre, item.color, item.talla].filter(Boolean).join(' · ');
	const line = `• ${item.cantidad}× ${name} — ${formatMoney(item.importe)}`;
	return item.personalizacion
		? `${line}\n  ✏️ Personalización: ${item.personalizacion} (por cotizar)`
		: line;
}
