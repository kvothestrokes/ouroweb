import { isSlug } from '#lib/domain/slug.js';

const KEY = 'ouroboros:favoritos';
const MAX = 200;

/** Reads the stored list, keeping only valid, unique product slugs. */
export function parseFavorites(raw: string | null): string[] {
	try {
		const value: unknown = JSON.parse(raw ?? '[]');
		if (!Array.isArray(value)) return [];
		const slugs = value.filter((item): item is string => typeof item === 'string' && isSlug(item));
		return slugs.filter((slug, i) => slugs.indexOf(slug) === i).slice(0, MAX);
	} catch {
		return [];
	}
}

/** Favorite products by slug, saved in this browser only (spec F9). */
class Favorites {
	slugs = $state<string[]>([]);
	#loaded = false;

	/** Call from the browser (an effect or event); the server never has favorites. */
	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		try {
			this.slugs = parseFavorites(localStorage.getItem(KEY));
		} catch {
			// Storage blocked (private mode): favorites live only for this visit.
		}
	}

	has(slug: string): boolean {
		return this.slugs.includes(slug);
	}

	toggle(slug: string) {
		this.load();
		this.slugs = this.has(slug)
			? this.slugs.filter((item) => item !== slug)
			: [slug, ...this.slugs].slice(0, MAX);
		try {
			localStorage.setItem(KEY, JSON.stringify(this.slugs));
		} catch {
			// Same as above.
		}
	}
}

export const favorites = new Favorites();
