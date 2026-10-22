import { describe, expect, it } from 'vitest';
import { allowRequest } from './rate-limit.js';

describe('allowRequest', () => {
	it('allows up to the limit inside the window and again after it', () => {
		const options = { limit: 2, windowMs: 1000 };
		expect(allowRequest('a', { ...options, now: 0 })).toBe(true);
		expect(allowRequest('a', { ...options, now: 10 })).toBe(true);
		expect(allowRequest('a', { ...options, now: 20 })).toBe(false);
		expect(allowRequest('b', { ...options, now: 20 })).toBe(true);
		expect(allowRequest('a', { ...options, now: 1001 })).toBe(true);
	});
});
