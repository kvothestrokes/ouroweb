import ImageKit from '@imagekit/nodejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedExpiry, signUrl } from './imagekit-signing.js';

const PRIVATE_KEY = 'private_test_key';
const ENDPOINT = 'https://ik.imagekit.io/ouroboros';
const DAY = 60 * 60 * 24;

describe('fixedExpiry', () => {
	it('returns the same timestamp for any moment inside the same period', () => {
		const startOfDay = 1_792_627_200; // a multiple of DAY
		expect(fixedExpiry(startOfDay)).toBe(fixedExpiry(startOfDay + DAY - 1));
	});

	it('expires between one and two periods after now', () => {
		const now = 1_792_650_000;
		const expiry = fixedExpiry(now);
		expect(expiry - now).toBeGreaterThan(DAY);
		expect(expiry - now).toBeLessThanOrEqual(2 * DAY);
		expect(expiry % DAY).toBe(0);
	});

	it('moves forward when the period changes', () => {
		const startOfDay = 1_792_627_200;
		expect(fixedExpiry(startOfDay + DAY)).toBe(fixedExpiry(startOfDay) + DAY);
	});
});

describe('signUrl', () => {
	afterEach(() => vi.useRealTimers());

	it('matches the official SDK signature for the same expiry', () => {
		const now = 1_792_650_000;
		vi.useFakeTimers({ now: now * 1000 });
		const expiry = fixedExpiry(now);
		const sdk = new ImageKit({ privateKey: PRIVATE_KEY });
		const transformation = [{ width: 800, quality: 80, format: 'auto' as const }];

		const expected = sdk.helper.buildSrc({
			urlEndpoint: ENDPOINT,
			src: '/ouroboros/bases/playera-negra.jpg',
			transformation,
			expiresIn: expiry - now
		});
		const unsigned = sdk.helper.buildSrc({
			urlEndpoint: ENDPOINT,
			src: '/ouroboros/bases/playera-negra.jpg',
			transformation
		});

		expect(signUrl(unsigned, { urlEndpoint: ENDPOINT, privateKey: PRIVATE_KEY, expiry })).toBe(
			expected
		);
	});

	it('produces an identical URL across renders inside the same period', () => {
		const url = `${ENDPOINT}/ouroboros/bases/playera-negra.jpg?tr=w-400`;
		const options = { urlEndpoint: ENDPOINT, privateKey: PRIVATE_KEY };
		const first = signUrl(url, { ...options, expiry: fixedExpiry(1_792_630_000) });
		const second = signUrl(url, { ...options, expiry: fixedExpiry(1_792_700_000) });
		expect(first).toBe(second);
		expect(first).toMatch(/[?&]ik-t=\d+&ik-s=[0-9a-f]{40}$/);
	});
});
