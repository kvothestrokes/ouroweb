import { fail } from '@sveltejs/kit';
import { parseTracking, reviewFromForm } from '#lib/domain/tracking.js';
import {
	NOT_FOUND,
	TOO_MANY,
	allowTracking,
	findTrackedOrder,
	submitReview,
	trackingView
} from '#lib/server/tracking.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const folio = (url.searchParams.get('folio') ?? '').toUpperCase();
	return { folio: /^[A-Z]{2,5}-\d{4}-\d{4}$/.test(folio) ? folio : '' };
};

// POST, so the 4 digits never end up in URLs, history or logs.
export const actions = {
	buscar: async ({ request, getClientAddress }) => {
		const input = parseTracking(await request.formData());
		if (!input.ok) return fail(400, { message: input.message });
		const { folio, digitos } = input.value;
		if (!(await allowTracking(getClientAddress(), folio)))
			return fail(429, { message: TOO_MANY, folio });

		const order = await findTrackedOrder(folio, digitos);
		if (!order) return fail(404, { message: NOT_FOUND, folio });
		return { view: trackingView(order), digitos };
	},

	resena: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const input = parseTracking(form);
		const review = reviewFromForm(form);
		if (!input.ok) return fail(400, { message: input.message });
		const { folio, digitos } = input.value;
		if (!(await allowTracking(getClientAddress(), folio)))
			return fail(429, { message: TOO_MANY, folio });

		const order = await findTrackedOrder(folio, digitos);
		if (!order) return fail(404, { message: NOT_FOUND, folio });
		if (!review.ok) {
			return fail(400, { reviewMessage: review.message, view: trackingView(order), digitos });
		}

		const photo = form.get('foto');
		const result = await submitReview(
			order,
			review.value,
			photo instanceof File && photo.size > 0 ? photo : null
		);
		if (!result.ok) {
			return fail(400, { reviewMessage: result.message, view: trackingView(order), digitos });
		}
		const updated = await findTrackedOrder(folio, digitos);
		return { view: updated ? trackingView(updated) : trackingView(order), digitos, reviewed: true };
	}
} satisfies Actions;
