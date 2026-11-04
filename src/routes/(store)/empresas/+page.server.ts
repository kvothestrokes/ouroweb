import { fail } from '@sveltejs/kit';
import { b2bQuoteFromForm } from '#lib/domain/b2b.js';
import {
	loadB2bPublicData,
	placeB2bQuoteOrder,
	resolvePublicB2bProspect
} from '#lib/server/b2b.js';
import { allowDurable } from '#lib/server/durable-rate-limit.js';
import { allowRequest } from '#lib/server/rate-limit.js';
import { storeData } from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [b2b, prospect] = await Promise.all([
		storeData(loadB2bPublicData),
		resolvePublicB2bProspect(url)
	]);

	return {
		...b2b,
		prospect
	};
};

export const actions = {
	cotizar: async ({ request, getClientAddress }) => {
		const ip = getClientAddress();
		if (
			!allowRequest(`b2b:${ip}`, { limit: 5, windowMs: 10 * 60 * 1000 }) ||
			!(await allowDurable(`b2b:${ip}`, { limit: 5, windowSeconds: 600, failOpen: true }))
		) {
			return fail(429, {
				message:
					'Recibimos varias solicitudes seguidas. Espera unos minutos o escríbenos por WhatsApp.'
			});
		}

		const form = await request.formData();
		const parsed = b2bQuoteFromForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const files = form
			.getAll('referencias')
			.filter((value): value is File => value instanceof File && value.size > 0);
		const prospectSlug = String(form.get('prospect_slug') ?? '').trim() || null;

		const result = await placeB2bQuoteOrder(parsed.value, files, prospectSlug);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { placed: result.order, empresa: parsed.value.empresa };
	}
} satisfies Actions;
