import { fail } from '@sveltejs/kit';
import { customRequestFromForm } from '#lib/domain/custom-request.js';
import { placeCustomOrder } from '#lib/server/custom-orders.js';
import { allowDurable } from '#lib/server/durable-rate-limit.js';
import { allowRequest } from '#lib/server/rate-limit.js';
import { loadCustomRequestTypes, storeData } from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	types: await storeData(loadCustomRequestTypes)
});

export const actions = {
	// Multipart form post: SvelteKit's origin check covers CSRF.
	enviar: async ({ request, getClientAddress }) => {
		const ip = getClientAddress();
		if (
			!allowRequest(`encargo:${ip}`, { limit: 5, windowMs: 10 * 60 * 1000 }) ||
			!(await allowDurable(`encargo:${ip}`, { limit: 5, windowSeconds: 600, failOpen: true }))
		) {
			return fail(429, { message: 'Demasiados intentos. Espera unos minutos.' });
		}
		const form = await request.formData();
		const input = customRequestFromForm(form);
		if (!input.ok) return fail(400, { message: input.message });

		const files = form
			.getAll('referencias')
			.filter((value): value is File => value instanceof File && value.size > 0);
		const result = await placeCustomOrder(input.value.request, input.value.contact, files);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { placed: result.order };
	}
} satisfies Actions;
