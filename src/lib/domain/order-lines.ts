import type { FormResult } from './catalog.js';
import type { CheckoutItem } from './checkout.js';
import { quoteLines } from './pricing.js';
import type { ProductDetail } from './store-product.js';

/** One `order_items` row: a snapshot of the catalog when the order was placed. */
export type OrderItemSnapshot = {
	product_id: string;
	nombre_snapshot: string;
	/** Color name as the customer saw it (`Negro`). */
	color: string | null;
	talla: string | null;
	cantidad: number;
	precio_unitario: number;
	recargo_talla: number;
	personalizacion_texto: string | null;
};

export type OrderLines = { items: OrderItemSnapshot[]; subtotal: number; descMayoreo: number };

const UNAVAILABLE =
	'Uno de los productos de tu carrito ya no está disponible. Quítalo e intenta de nuevo.';

/**
 * Checks every cart line against the current public catalog and prices it from there
 * (CLAUDE.md rule 1: prices sent by the browser are never used).
 */
export function buildOrderLines(
	items: CheckoutItem[],
	products: ProductDetail[]
): FormResult<OrderLines> {
	const snapshots: OrderItemSnapshot[] = [];
	const quote: Parameters<typeof quoteLines>[0] = [];
	const piecesPerStock = new Map<string, number>();

	for (const item of items) {
		const product = products.find((candidate) => candidate.slug === item.slug);
		if (!product || product.precioBase === null) return { ok: false, message: UNAVAILABLE };

		const color = product.colorOptions.find((option) => option.key === item.color) ?? null;
		const needsColor = product.colorOptions.length > 0;
		const needsSize = product.todasLasTallas.length > 0;
		if (needsColor ? !color : item.color !== null) return { ok: false, message: UNAVAILABLE };
		if (
			needsSize ? !item.talla || !product.todasLasTallas.includes(item.talla) : item.talla !== null
		) {
			return { ok: false, message: UNAVAILABLE };
		}

		if (!product.bajoPedido) {
			const key = `${color?.baseId}:${item.talla}`;
			const pieces = (piecesPerStock.get(key) ?? 0) + item.cantidad;
			piecesPerStock.set(key, pieces);
			const available = product.stock[key] ?? 0;
			if (pieces > available) {
				const detail = [color?.nombre, item.talla].filter(Boolean).join(', ');
				return {
					ok: false,
					message: available
						? `Solo quedan ${available} ${available === 1 ? 'pieza' : 'piezas'} de ${product.nombre} (${detail}). Ajusta la cantidad.`
						: `Se agotó ${product.nombre} (${detail}). Quítalo o elige otra opción.`
				};
			}
		}

		const recargo = item.talla ? (product.recargos[item.talla] ?? 0) : 0;
		snapshots.push({
			product_id: product.id,
			nombre_snapshot: product.nombre,
			color: color?.nombre ?? null,
			talla: item.talla,
			cantidad: item.cantidad,
			precio_unitario: product.precioBase,
			recargo_talla: recargo,
			personalizacion_texto: item.personalizacion
		});
		quote.push({
			precioBase: product.precioBase,
			recargo,
			cantidad: item.cantidad,
			mayoreo:
				product.mayoreo && product.prenda ? { grupo: product.prenda, ...product.mayoreo } : null
		});
	}

	const { subtotal, descMayoreo } = quoteLines(quote);
	return { ok: true, value: { items: snapshots, subtotal, descMayoreo } };
}
