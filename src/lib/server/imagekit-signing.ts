import { createHmac } from 'node:crypto';

/** Length of a signing period in seconds (24 h). */
export const SIGNING_PERIOD = 60 * 60 * 24;

/**
 * Expiry timestamp (unix seconds) that stays constant for the whole current
 * period, so a signed URL is identical across renders and the CDN/browser can
 * cache it. It lands on a period boundary between one and two periods ahead.
 */
export function fixedExpiry(nowSeconds = Date.now() / 1000, period = SIGNING_PERIOD): number {
	return Math.floor(nowSeconds / period) * period + period * 2;
}

export interface SignOptions {
	urlEndpoint: string;
	privateKey: string;
	expiry: number;
}

/**
 * Signs an ImageKit URL with a caller-provided expiry. Mirrors the official
 * SDK: HMAC-SHA1(privateKey, urlWithoutEndpoint + expiry) → `ik-t` and `ik-s`.
 * The SDK only supports "now + N seconds", which would change on every render.
 */
export function signUrl(url: string, { urlEndpoint, privateKey, expiry }: SignOptions): string {
	const endpoint = urlEndpoint.endsWith('/') ? urlEndpoint : `${urlEndpoint}/`;
	const signature = createHmac('sha1', privateKey)
		.update(url.replace(endpoint, '') + String(expiry))
		.digest('hex');
	const separator = new URL(url).search ? '&' : '?';
	return `${url}${separator}ik-t=${expiry}&ik-s=${signature}`;
}
