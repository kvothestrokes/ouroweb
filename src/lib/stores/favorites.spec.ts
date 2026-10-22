import { describe, expect, it } from 'vitest';
import { parseFavorites } from './favorites.svelte.js';

describe('parseFavorites', () => {
	it('keeps unique valid slugs', () => {
		expect(parseFavorites('["goku","goku","<b>","akatsuki",3]')).toEqual(['goku', 'akatsuki']);
	});

	it('returns an empty list for missing or broken data', () => {
		expect(parseFavorites(null)).toEqual([]);
		expect(parseFavorites('{nope')).toEqual([]);
		expect(parseFavorites('{"a":1}')).toEqual([]);
	});
});
