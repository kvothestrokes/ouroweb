import { describe, expect, it } from 'vitest';
import { adminFromClaims, isAdminRoute, safeAdminRedirect } from './admin-auth.js';

describe('isAdminRoute', () => {
	it('protects the panel and its subpaths', () => {
		expect(isAdminRoute('/admin')).toBe(true);
		expect(isAdminRoute('/admin/')).toBe(true);
		expect(isAdminRoute('/admin/categorias')).toBe(true);
		expect(isAdminRoute('/admin/logout')).toBe(true);
	});

	it('leaves the login page and the store public', () => {
		expect(isAdminRoute('/admin/login')).toBe(false);
		expect(isAdminRoute('/admin/login/')).toBe(false);
		expect(isAdminRoute('/')).toBe(false);
		expect(isAdminRoute('/administracion')).toBe(false);
		expect(isAdminRoute('/c/ropa')).toBe(false);
	});
});

describe('adminFromClaims', () => {
	it('accepts a user whose app_metadata.role is admin', () => {
		expect(
			adminFromClaims({ sub: 'u1', email: 'a@b.mx', app_metadata: { role: 'admin' } })
		).toEqual({ id: 'u1', email: 'a@b.mx' });
	});

	it('rejects missing claims and any other role', () => {
		expect(adminFromClaims(null)).toBeNull();
		expect(adminFromClaims(undefined)).toBeNull();
		expect(adminFromClaims({ sub: 'u1', email: 'a@b.mx' })).toBeNull();
		expect(adminFromClaims({ sub: 'u1', app_metadata: { role: 'editor' } })).toBeNull();
		// user_metadata is writable by the user, so it must never grant access.
		expect(adminFromClaims({ sub: 'u1', user_metadata: { role: 'admin' } })).toBeNull();
	});
});

describe('safeAdminRedirect', () => {
	it('keeps panel paths with their query string', () => {
		expect(safeAdminRedirect('/admin/productos?page=2')).toBe('/admin/productos?page=2');
	});

	it('falls back to /admin for anything outside the panel', () => {
		expect(safeAdminRedirect(null)).toBe('/admin');
		expect(safeAdminRedirect('')).toBe('/admin');
		expect(safeAdminRedirect('https://evil.example/admin')).toBe('/admin');
		expect(safeAdminRedirect('//evil.example/admin')).toBe('/admin');
		expect(safeAdminRedirect('/admin/../checkout')).toBe('/admin');
		expect(safeAdminRedirect('/administracion')).toBe('/admin');
		expect(safeAdminRedirect('/admin/login')).toBe('/admin');
	});
});
