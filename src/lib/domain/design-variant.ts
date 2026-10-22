/**
 * Widest design we store. Mockups print it at ~600 px of a 2048 px photo and serve at most
 * 1000 px, so a larger original only adds risk if it leaks and nothing to the mockup.
 */
export const MAX_DESIGN_WIDTH = 1600;

/** Widest real product photo we store (served at most 1000 px). */
export const MAX_PHOTO_WIDTH = 2000;

export type DesignFiles = {
	path_prenda_oscura: string | null;
	path_prenda_clara: string | null;
};

/**
 * Design version to print on a garment (spec section 5.2): light garments use the
 * light-garment version (e.g. dark ink) when there is one; otherwise the only version wins.
 */
export function designPathFor(design: DesignFiles, garmentIsLight: boolean): string | null {
	const preferred = garmentIsLight ? design.path_prenda_clara : design.path_prenda_oscura;
	const fallback = garmentIsLight ? design.path_prenda_oscura : design.path_prenda_clara;
	return preferred ?? fallback ?? null;
}
