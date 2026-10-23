import { describe, expect, it } from 'vitest';
import { lastFourDigits, normalizeMxPhone } from './phone.js';

describe('normalizeMxPhone', () => {
	it('accepts 10 national digits with spaces, dashes or the +52 prefix', () => {
		expect(normalizeMxPhone('961 242 3984')).toBe('529612423984');
		expect(normalizeMxPhone('961-242-3984')).toBe('529612423984');
		expect(normalizeMxPhone('+52 961 242 3984')).toBe('529612423984');
		expect(normalizeMxPhone('52 9612423984')).toBe('529612423984');
	});

	it('rejects anything that is not a 10-digit number', () => {
		expect(normalizeMxPhone('96124239')).toBeNull();
		expect(normalizeMxPhone('abc')).toBeNull();
		expect(normalizeMxPhone('+1 961 242 3984 5')).toBeNull();
	});
});

describe('lastFourDigits', () => {
	it('returns the last four digits', () => {
		expect(lastFourDigits('529612423984')).toBe('3984');
	});
});
