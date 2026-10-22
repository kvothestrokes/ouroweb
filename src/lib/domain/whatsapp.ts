/** `https://wa.me/<number>?text=<message>` (CLAUDE.md, "Dominio clave"). */
export function whatsappLink(number: string, message?: string): string {
	const base = `https://wa.me/${number}`;
	return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
