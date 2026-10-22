const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Same rule as the `slug` checks in the database. */
export function isSlug(value: string): boolean {
	return SLUG.test(value);
}

/** `Playeras con diseño` → `playeras-con-diseno`. */
export function slugify(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
