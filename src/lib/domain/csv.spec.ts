import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.js';

describe('parseCsv', () => {
	it('reads plain rows and drops the UTF-8 BOM', () => {
		expect(parseCsv('\uFEFFa,b\n1,2\n')).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('handles quoted fields with commas, escaped quotes and line breaks', () => {
		expect(parseCsv('nombre,descripcion\r\n"Taza, grande","Dice ""hola""\nadiós"\r\n')).toEqual([
			['nombre', 'descripcion'],
			['Taza, grande', 'Dice "hola"\nadiós']
		]);
	});

	it('detects semicolon-separated files (Excel in some locales)', () => {
		expect(parseCsv('a;b\n"1,5";2')).toEqual([
			['a', 'b'],
			['1,5', '2']
		]);
	});

	it('keeps empty trailing fields and skips blank lines', () => {
		expect(parseCsv('a,b,c\n1,,\n\n2,3,4')).toEqual([
			['a', 'b', 'c'],
			['1', '', ''],
			['2', '3', '4']
		]);
	});

	it('rejects an unterminated quoted field', () => {
		expect(() => parseCsv('a\n"abc')).toThrow();
	});
});

describe('toCsv', () => {
	it('quotes only the fields that need it and round-trips', () => {
		const rows = [
			['nombre', 'nota'],
			['Taza', 'dice "hola", ok'],
			['Vela', 'línea\nnueva']
		];
		const text = toCsv(rows);
		expect(text).toBe('nombre,nota\nTaza,"dice ""hola"", ok"\nVela,"línea\nnueva"\n');
		expect(parseCsv(text)).toEqual(rows);
	});
});
