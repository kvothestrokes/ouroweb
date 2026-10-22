import { createServerClient } from '@supabase/ssr';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { adminFromClaims, isAdminRoute } from '#lib/server/admin-auth.js';
import type { Database } from '#lib/types/database.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Per-request client with the visitor's session: queries run under RLS as that user.
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet, headers) => {
					for (const { name, value, options } of cookiesToSet) {
						// No browser Supabase client reads the session, so scripts never need it.
						event.cookies.set(name, value, { ...options, path: '/', httpOnly: true });
					}
					try {
						event.setHeaders(headers);
					} catch {
						// Already set for this response (e.g. by the admin no-store header below).
					}
				}
			}
		}
	);

	// getClaims() verifies the JWT; never trust the unverified session from cookies.
	event.locals.getAdmin = async () => {
		const { data, error } = await event.locals.supabase.auth.getClaims();
		return error ? null : adminFromClaims(data?.claims);
	};

	const { pathname } = event.url;
	const isPanel = isAdminRoute(pathname);
	if (isPanel || pathname.startsWith('/admin')) {
		event.locals.admin = await event.locals.getAdmin();
	} else {
		event.locals.admin = null;
	}

	// The guard lives here, not in a layout load: form actions do not run parent loads.
	if (isPanel && !event.locals.admin) {
		const target = pathname + event.url.search;
		redirect(303, `/admin/login?redirectTo=${encodeURIComponent(target)}`);
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});

	if (pathname.startsWith('/admin')) {
		response.headers.set('cache-control', 'private, no-store');
		response.headers.set('x-robots-tag', 'noindex, nofollow');
	}

	return response;
};
