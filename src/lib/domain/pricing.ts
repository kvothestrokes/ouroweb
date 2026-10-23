/**
 * Unit price before size surcharge: the product's own price, or its garment type price.
 * Null means "no price yet" and must never be treated as 0.
 */
export function basePrice(
	product: { precio_base: number | null },
	garmentType: { precio_normal: number | null } | null
): number | null {
	return product.precio_base ?? garmentType?.precio_normal ?? null;
}

export type QuoteLine = {
	/** Unit price before the size surcharge, in cents. */
	precioBase: number;
	recargo: number;
	cantidad: number;
	/**
	 * Bulk price of the garment type (`grupo`), only for products that inherit the type
	 * price. Pieces of the same group add up across lines.
	 */
	mayoreo: { grupo: string; precio: number; cantidadMin: number } | null;
};

export type Quote = { importes: number[]; subtotal: number; descMayoreo: number };

/**
 * Spec section 7: line = (base + surcharge) × quantity; the bulk price becomes a discount
 * (`desc_mayoreo`) so the item snapshot keeps the regular price.
 */
export function quoteLines(lines: QuoteLine[]): Quote {
	const importes = lines.map((line) => (line.precioBase + line.recargo) * line.cantidad);

	const piecesPerGroup = new Map<string, number>();
	for (const line of lines) {
		if (!line.mayoreo) continue;
		const group = line.mayoreo.grupo;
		piecesPerGroup.set(group, (piecesPerGroup.get(group) ?? 0) + line.cantidad);
	}
	const descMayoreo = lines.reduce((sum, line) => {
		const bulk = line.mayoreo;
		if (!bulk || (piecesPerGroup.get(bulk.grupo) ?? 0) < bulk.cantidadMin) return sum;
		return sum + Math.max(0, line.precioBase - bulk.precio) * line.cantidad;
	}, 0);

	return { importes, subtotal: importes.reduce((a, b) => a + b, 0), descMayoreo };
}

/** `YYYY-MM-DD` in Mexico City: offers end at the end of their day there. */
export function mexicoToday(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
}

/** The product's offer price when it applies today, else null (no end date = no end). */
export function activeOffer(
	product: { precio_oferta: number | null; oferta_hasta: string | null },
	today: string
): number | null {
	if (product.precio_oferta === null) return null;
	return product.oferta_hasta === null || today <= product.oferta_hasta
		? product.precio_oferta
		: null;
}
