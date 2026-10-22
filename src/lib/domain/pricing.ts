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
