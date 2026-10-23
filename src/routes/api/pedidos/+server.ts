import { error, json } from '@sveltejs/kit';
import { parseCheckout } from '#lib/domain/checkout.js';
import { placeOrder } from '#lib/server/orders.js';
import { allowDurable } from '#lib/server/durable-rate-limit.js';
import { allowRequest } from '#lib/server/rate-limit.js';
import { readBodyLimited } from '#lib/server/read-body.js';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 32 * 1024;

// POST /api/pedidos — creates a catalog order from the browser cart (spec 6.1).
// JSON only: a cross-site page cannot send it without a CORS preflight, which we never allow.
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		error(415, 'Formato no soportado');
	}
	if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
		error(413, 'Pedido demasiado grande');
	}
	// Memory first (cheap, per instance), then the shared limit in the database.
	const ip = getClientAddress();
	if (
		!allowRequest(`pedido:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 }) ||
		!(await allowDurable(`pedido:${ip}`, { limit: 10, windowSeconds: 600, failOpen: true }))
	) {
		return json({ message: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
	}

	const body = await readBodyLimited(request, MAX_BODY_BYTES);
	if (body === null) error(413, 'Pedido demasiado grande');
	let input: unknown;
	try {
		input = JSON.parse(body);
	} catch {
		return json({ message: 'Revisa los datos de tu pedido.' }, { status: 400 });
	}

	const checkout = parseCheckout(input);
	if (!checkout.ok) return json({ message: checkout.message }, { status: 400 });

	const result = await placeOrder(checkout.value);
	if (!result.ok) return json({ message: result.message }, { status: result.status });
	return json(result.order, { status: 201, headers: { 'cache-control': 'no-store' } });
};
