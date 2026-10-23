import { supabaseAdmin } from './supabase-admin.js';

/**
 * Request limit shared by every server instance (table `rate_limits`). When the database
 * cannot answer, `failOpen` decides: true lets the request through (the operation will
 * hit the database anyway), false blocks it (guessing endpoints).
 */
export async function allowDurable(
	key: string,
	{ limit, windowSeconds, failOpen }: { limit: number; windowSeconds: number; failOpen: boolean }
): Promise<boolean> {
	const { data, error } = await supabaseAdmin.rpc('hit_rate_limit', {
		p_key: key,
		p_limit: limit,
		p_window_seconds: windowSeconds
	});
	return error ? failOpen : data === true;
}
