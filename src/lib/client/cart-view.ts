import type { CheckoutItem } from '#lib/domain/checkout.js';
import { buildOrderLines } from '#lib/domain/order-lines.js';
import {
	availableSizes,
	productImages,
	type ProductDetail,
	type ProductImage
} from '#lib/domain/store-product.js';
import { lineKey, type CartLine } from '#lib/stores/cart.svelte.js';

export type CartRow = {
	key: string;
	line: CartLine;
	product: ProductDetail | null;
	image: ProductImage | null;
	colorName: string | null;
	/** Unit price with size surcharge, in cents. */
	unitPrice: number | null;
	/** Why the line cannot be ordered as is, if anything. */
	problem: string | null;
};

/** Joins the browser cart with the current catalog to show it. */
export function cartRows(lines: CartLine[], products: ProductDetail[]): CartRow[] {
	return lines.map((line) => {
		const product = products.find((item) => item.slug === line.slug) ?? null;
		const color = product?.colorOptions.find((option) => option.key === line.color) ?? null;
		const images = product ? productImages(product) : [];
		let problem: string | null = null;
		if (!product || product.precioBase === null) problem = 'Ya no está disponible.';
		else if (line.talla && !availableSizes(product, line.color).includes(line.talla)) {
			problem = 'Esta talla se agotó en este color.';
		}
		return {
			key: lineKey(line),
			line,
			product,
			image: images.find((image) => image.key === line.color) ?? images[0] ?? null,
			colorName: color?.nombre ?? null,
			unitPrice:
				product && product.precioBase !== null
					? product.precioBase + (line.talla ? (product.recargos[line.talla] ?? 0) : 0)
					: null,
			problem
		};
	});
}

export function toCheckoutItems(lines: CartLine[]): CheckoutItem[] {
	return lines.map(({ slug, color, talla, cantidad, personalizacion }) => ({
		slug,
		color,
		talla,
		cantidad,
		personalizacion
	}));
}

/** Same validation and pricing the server runs, to show the summary before ordering. */
export function cartQuote(lines: CartLine[], products: ProductDetail[]) {
	return buildOrderLines(toCheckoutItems(lines), products);
}
