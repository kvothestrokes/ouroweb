import { describe, expect, it } from 'vitest';
import { readBodyLimited } from './read-body.js';

describe('readBodyLimited', () => {
	it('returns the text when it fits and null when it does not', async () => {
		const request = (body: string) => new Request('http://x', { method: 'POST', body });
		expect(await readBodyLimited(request('{"a":"ñ"}'), 32)).toBe('{"a":"ñ"}');
		expect(await readBodyLimited(request('x'.repeat(33)), 32)).toBeNull();
	});
});
