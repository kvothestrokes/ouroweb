/** Authenticated admin, derived from verified JWT claims (see `hooks.server.ts`). */
export type Admin = { id: string; email: string | null };

const LOGIN_PATH = '/admin/login';

/** True for every panel path that requires the admin; the login page stays public. */
export function isAdminRoute(pathname: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (path === LOGIN_PATH) return false;
	return path === '/admin' || path.startsWith('/admin/');
}

/**
 * Only `app_metadata` counts: it is written exclusively with the secret key, while
 * `user_metadata` can be edited by the user. Mirrors `public.is_admin()` in the database.
 */
export function adminFromClaims(claims: unknown): Admin | null {
	if (typeof claims !== 'object' || claims === null) return null;
	const { sub, email, app_metadata } = claims as Record<string, unknown>;
	if (typeof sub !== 'string') return null;
	const role =
		typeof app_metadata === 'object' && app_metadata !== null
			? (app_metadata as Record<string, unknown>).role
			: undefined;
	if (role !== 'admin') return null;
	return { id: sub, email: typeof email === 'string' ? email : null };
}

/** Same-origin panel path to return to after login; anything else falls back to `/admin`. */
export function safeAdminRedirect(value: string | null | undefined): string {
	const fallback = '/admin';
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return fallback;
	}
	const base = 'http://internal.invalid';
	const url = new URL(value, base);
	if (url.origin !== base || !isAdminRoute(url.pathname)) return fallback;
	return url.pathname + url.search;
}
