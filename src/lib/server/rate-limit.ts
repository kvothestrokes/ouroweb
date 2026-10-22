const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

/**
 * Sliding-window limiter kept in memory. On Vercel each instance has its own memory, so
 * this only slows down bursts; durable limits live in the database.
 */
export function allowRequest(
	key: string,
	{ limit, windowMs, now = Date.now() }: { limit: number; windowMs: number; now?: number }
): boolean {
	const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
	if (recent.length >= limit) {
		hits.set(key, recent);
		return false;
	}
	recent.push(now);
	hits.set(key, recent);
	if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value!);
	return true;
}
