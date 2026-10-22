import { describe, expect, it } from 'vitest';
import { isSlug, slugify } from './slug.js';

describe('slugify', () => {
	it('builds URL slugs from Spanish names', () => {
		expect(slugify('Playeras con diseño')).toBe('playeras-con-diseno');
		expect(slugify('Impresión 3D')).toBe('impresion-3d');
		expect(slugify('  Dragon Ball  Z!! ')).toBe('dragon-ball-z');
		expect(slugify('Ñoños & Cía.')).toBe('nonos-cia');
	});

	it('returns an empty string when nothing usable is left', () => {
		expect(slugify('¡¡!!')).toBe('');
	});
});

describe('isSlug', () => {
	it('accepts only lowercase words joined by single hyphens', () => {
		expect(isSlug('playeras-con-diseno')).toBe(true);
		expect(isSlug('3d')).toBe(true);
		expect(isSlug('Playeras')).toBe(false);
		expect(isSlug('doble--guion')).toBe(false);
		expect(isSlug('-inicio')).toBe(false);
		expect(isSlug('')).toBe(false);
	});
});
