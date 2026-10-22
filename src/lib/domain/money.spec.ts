import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseMoney } from './money.js';

describe('parseMoney', () => {
	it('reads pesos as typed in a form and returns cents', () => {
		expect(parseMoney('170')).toBe(17000);
		expect(parseMoney('170.5')).toBe(17050);
		expect(parseMoney('$1,200.00')).toBe(120000);
		expect(parseMoney(' 30 ')).toBe(3000);
		expect(parseMoney('0')).toBe(0);
	});

	it('returns null for an empty field', () => {
		expect(parseMoney('')).toBeNull();
		expect(parseMoney('   ')).toBeNull();
		expect(parseMoney(null)).toBeNull();
	});

	it('returns NaN for anything that is not an amount', () => {
		expect(parseMoney('abc')).toBeNaN();
		expect(parseMoney('-5')).toBeNaN();
		expect(parseMoney('1.234')).toBeNaN();
		expect(parseMoney('1.2.3')).toBeNaN();
	});
});

describe('formatMoney', () => {
	it('formats cents as Mexican pesos', () => {
		expect(formatMoney(17000)).toBe('$170.00');
		expect(formatMoney(120050)).toBe('$1,200.50');
	});
});

describe('centsToInput', () => {
	it('prints cents back for an input field, without trailing zeros', () => {
		expect(centsToInput(17000)).toBe('170');
		expect(centsToInput(17050)).toBe('170.5');
		expect(centsToInput(null)).toBe('');
	});
});
