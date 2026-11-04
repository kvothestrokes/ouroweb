import { fail } from '@sveltejs/kit';
import { b2bQuoteFromForm, sanitizeProspectName } from '#lib/domain/b2b.js';
import { isSlug } from '#lib/domain/slug.js';
import { loadB2bPublicData, placeB2bQuoteOrder } from '#lib/server/b2b.js';
import { allowDurable } from '#lib/server/durable-rate-limit.js';
import { allowRequest } from '#lib/server/rate-limit.js';
import { storeData } from '#lib/server/store.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const b2b = await storeData(loadB2bPublicData);
	const prospectEmpresa = sanitizeProspectName(url.searchParams.get('para'), 60);
	const prospectContacto = sanitizeProspectName(url.searchParams.get('contacto'), 40);
	const rawPack = url.searchParams.get('pack')?.trim() ?? '';
	const selectedPackSlug = rawPack && isSlug(rawPack) ? rawPack : null;

	return {
		...b2b,
		prospect: {
			empresa: prospectEmpresa,
			contacto: prospectContacto,
			packSlug: selectedPackSlug
		}
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

		const result = await placeB2bQuoteOrder(parsed.value, files);
		if (!result.ok) return fail(result.status, { message: result.message });
		return { placed: result.order, empresa: parsed.value.empresa };
	}
} satisfies Actions;
