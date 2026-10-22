import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	// hooks.server.ts already guards every panel request; this keeps the type narrow.
	if (!locals.admin) redirect(303, `/admin/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	return { adminEmail: locals.admin.email };
};
