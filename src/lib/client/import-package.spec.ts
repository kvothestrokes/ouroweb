import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readImportPackage } from './import-package.js';

const CSV = 'nombre,categoria,tipo_imagen\nTaza,tazas,foto\n';

function zipFile(entries: Record<string, Uint8Array>, name = 'carga.zip'): File {
	return new File([new Uint8Array(zipSync(entries))], name, { type: 'application/zip' });
}

describe('readImportPackage', () => {
	it('reads the CSV and indexes images by file name from a ZIP', async () => {
		const result = await readImportPackage([
			zipFile({
				'carga/productos.csv': strToU8(CSV),
				'carga/imagenes/calavera.png': new Uint8Array([1, 2, 3]),
				'carga/imagenes/taza.JPG': new Uint8Array([4]),
				'__MACOSX/carga/._calavera.png': new Uint8Array([9]),
				'carga/.DS_Store': new Uint8Array([9]),
				'carga/notas.txt': strToU8('hola')
			})
		]);
		if (!result.ok) throw new Error(result.message);
		expect(result.value.csv).toBe(CSV);
		expect([...result.value.images.keys()].sort()).toEqual(['calavera.png', 'taza.jpg']);
		expect(result.value.images.get('calavera.png')?.size).toBe(3);
		expect(result.value.images.get('calavera.png')?.type).toBe('image/png');
		expect(result.value.images.get('taza.jpg')?.name).toBe('taza.jpg');
	});

	it('normalizes Windows paths, uppercase extensions and NFD accents in image names', async () => {
		const nfdName = 'carga\\imagenes\\Calavéra.PNG'.normalize('NFD');
		const result = await readImportPackage([
			zipFile({
				'carga\\productos.csv': strToU8(CSV),
				[nfdName]: new Uint8Array([1, 2])
			})
		]);
		if (!result.ok) throw new Error(result.message);
		const expected = 'calavéra.png'.normalize('NFC');
		expect([...result.value.images.keys()]).toEqual([expected]);
		expect(result.value.images.get(expected)?.name).toBe(expected);
	});

	it('accepts a CSV with loose image files', async () => {
		const result = await readImportPackage([
			new File([CSV], 'productos.csv'),
			new File([new Uint8Array([1])], 'a.webp')
		]);
		expect(result.ok && [...result.value.images.keys()]).toEqual(['a.webp']);
	});

	it('decodes CSV files saved by Excel as Windows-1252', async () => {
		const latin1 = new Uint8Array([...strToU8('nombre\nCaf'), 0xe9, 0x0a]);
		const result = await readImportPackage([new File([latin1], 'productos.csv')]);
		expect(result.ok && result.value.csv).toBe('nombre\nCafé\n');
	});

	it('rejects packages without exactly one CSV or with repeated image names', async () => {
		expect((await readImportPackage([zipFile({ 'a.png': new Uint8Array([1]) })])).ok).toBe(false);
		const twoCsv = zipFile({ 'a.csv': strToU8(CSV), 'b.csv': strToU8(CSV) });
		expect((await readImportPackage([twoCsv])).ok).toBe(false);
		const repeated = zipFile({
			'productos.csv': strToU8(CSV),
			'uno/a.png': new Uint8Array([1]),
			'dos/a.png': new Uint8Array([2])
		});
		expect(await readImportPackage([repeated])).toEqual({
			ok: false,
			message: expect.stringContaining('a.png')
		});
	});

	it('rejects files that are not a valid ZIP', async () => {
		const result = await readImportPackage([new File(['nope'], 'carga.zip')]);
		expect(result.ok).toBe(false);
	});
});
