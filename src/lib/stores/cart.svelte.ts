import { isSlug } from '#lib/domain/slug.js';

const KEY = 'ouroboros:carrito';
const MAX_LINES = 50;
export const MAX_QUANTITY = 99;

/**
 * One cart line. Prices are NOT stored: the server recalculates them from the database at
 * checkout (CLAUDE.md rule 1); the cart only shows the catalog's current price.
 */
export type CartLine = {
	slug: string;
	/** Color key (`negro`) for garment products. */
	color: string | null;
	talla: string | null;
	cantidad: number;
	/** Free text the customer wants added; quoted by WhatsApp. */
	personalizacion: string | null;
};

export function lineKey(line: Omit<CartLine, 'cantidad'>): string {
	return [line.slug, line.color ?? '', line.talla ?? '', line.personalizacion ?? ''].join('|');
}

function isLine(value: unknown): value is CartLine {
	if (!value || typeof value !== 'object') return false;
	const line = value as Record<string, unknown>;
	return (
		typeof line.slug === 'string' &&
		isSlug(line.slug) &&
		(line.color === null || (typeof line.color === 'string' && isSlug(line.color))) &&
		(line.talla === null ||
			(typeof line.talla === 'string' && /^[A-Z0-9]{1,5}$/.test(line.talla))) &&
		Number.isInteger(line.cantidad) &&
		(line.cantidad as number) >= 1 &&
		(line.cantidad as number) <= MAX_QUANTITY &&
		(line.personalizacion === null ||
			(typeof line.personalizacion === 'string' && line.personalizacion.length <= 500))
	);
}

/** Reads the stored cart, dropping anything malformed. */
export function parseCart(raw: string | null): CartLine[] {
	try {
		const value: unknown = JSON.parse(raw ?? '[]');
		return Array.isArray(value) ? value.filter(isLine).slice(0, MAX_LINES) : [];
	} catch {
		return [];
	}
}

/** Adds a line, merging it with an identical one (same product, color, size and text). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
	const key = lineKey(line);
	const existing = lines.find((item) => lineKey(item) === key);
	if (existing) {
		return lines.map((item) =>
			item === existing
				? { ...item, cantidad: Math.min(MAX_QUANTITY, item.cantidad + line.cantidad) }
				: item
		);
	}
	return [...lines, line].slice(-MAX_LINES);
}

/** Cart saved in this browser (spec 6.1, step 2). */
class Cart {
	lines = $state<CartLine[]>([]);
	#loaded = false;

	count = $derived(this.lines.reduce((sum, line) => sum + line.cantidad, 0));

	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		try {
			this.lines = parseCart(localStorage.getItem(KEY));
		} catch {
			// Storage blocked: the cart lives only for this visit.
		}
	}

	#save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.lines));
		} catch {
			// Same as above.
		}
	}

	add(line: CartLine) {
		this.load();
		this.lines = addLine(this.lines, line);
		this.#save();
	}

	setQuantity(key: string, cantidad: number) {
		this.lines = this.lines.map((line) =>
			lineKey(line) === key
				? { ...line, cantidad: Math.max(1, Math.min(MAX_QUANTITY, Math.trunc(cantidad) || 1)) }
				: line
		);
		this.#save();
	}

	remove(key: string) {
		this.lines = this.lines.filter((line) => lineKey(line) !== key);
		this.#save();
	}

	clear() {
		this.lines = [];
		this.#save();
	}
}

export const cart = new Cart();
