import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { safeAdminRedirect } from '#lib/server/admin-auth.js';
import type { Actions, PageServerLoad } from './$types';

const credentials = z.object({
	email: z.email().trim().toLowerCase(),
	password: z.string().min(1)
});

// One message for every failure, so the form never reveals which part was wrong.
const INVALID = 'Correo o contraseña incorrectos.';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, safeAdminRedirect(url.searchParams.get('redirectTo')));
};

export const actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const parsed = credentials.safeParse({
			email: form.get('email'),
			password: form.get('password')
		});
		const email = String(form.get('email') ?? '');

		if (!parsed.success) return fail(400, { email, message: INVALID });

		const { error } = await locals.supabase.auth.signInWithPassword(parsed.data);
		if (error) {
			const message =
				error.status === 429
					? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
					: INVALID;
			return fail(error.status === 429 ? 429 : 400, { email, message });
		}

		// A valid account without the admin role must not keep a session.
		if (!(await locals.getAdmin())) {
			await locals.supabase.auth.signOut();
			// Same status as bad credentials, so the response never confirms a valid password.
			return fail(400, { email, message: INVALID });
		}

		redirect(303, safeAdminRedirect(url.searchParams.get('redirectTo')));
	}
} satisfies Actions;
