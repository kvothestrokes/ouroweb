import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST only: SvelteKit's origin check protects form posts against CSRF.
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/admin/login');
};
