import { describe, expect, it } from 'vitest';
import {
	PENDING_DESIGN_ID,
	designKey,
	normalizeFileName,
	parseImportTable,
	planImport,
	planImportRow,
	rowsFromJson,
	type ImportCatalog,
	type ImportRow
} from './product-import.js';

const CATEGORY = '11111111-1111-4111-8111-111111111111';
const PLAYERA = '22222222-2222-4222-8222-222222222222';
const DESIGN = '33333333-3333-4333-8333-333333333333';
const NEGRO = '44444444-4444-4444-8444-444444444444';
const BLANCO = '55555555-5555-4555-8555-555555555555';
const SUDADERA = '66666666-6666-4666-8666-666666666666';
const SUDADERA_NEGRA = '77777777-7777-4777-8777-777777777777';
const ANIME = '88888888-8888-4888-8888-888888888888';
const TAZAS = '99999999-9999-4999-8999-999999999999';

const catalog: ImportCatalog = {
	categories: [
		{ id: CATEGORY, slug: 'playeras-anime' },
		{ id: TAZAS, slug: 'tazas' }
	],
	garmentTypes: [
		{ id: PLAYERA, nombre: 'Playera', tallas: ['CH', 'M', 'G'], precio_normal: 17000 },
		{ id: SUDADERA, nombre: 'Sudadera', tallas: ['M'], precio_normal: null }
	],
	bases: [
		{ id: NEGRO, garment_type_id: PLAYERA, color_nombre: 'Negro' },
		{ id: BLANCO, garment_type_id: PLAYERA, color_nombre: 'Blanco Hueso' },
		{ id: SUDADERA_NEGRA, garment_type_id: SUDADERA, color_nombre: 'Negro' }
	],
	collections: [{ id: ANIME, slug: 'anime' }],
	designs: [{ id: DESIGN, nombre: 'Calavera' }],
	existingSlugs: ['ya-existe']
};

const files = new Set(['calavera.png', 'calavera-clara.png', 'taza-1.jpg', 'taza-2.jpg']);

const mockup: ImportRow = {
	nombre: 'Playera Calavera',
	categoria: 'playeras-anime',
	tipo_imagen: 'mockup',
	tipo_prenda: 'playera',
	diseno_oscura: 'calavera.png',
	colores: 'negro | blanco hueso'
};

const foto: ImportRow = {
	nombre: 'Taza Ouroboros',
	categoria: 'tazas',
	tipo_imagen: 'foto',
	precio: '$250',
	fotos: 'taza-1.jpg|taza-2.jpg'
};

function plan(row: ImportRow) {
	return planImportRow(row, catalog, files);
}

function message(row: ImportRow): string {
	const result = plan(row);
	if (result.ok) throw new Error('expected an error');
	return result.message;
}

describe('parseImportTable', () => {
	it('maps rows by normalized header and keeps the spreadsheet line number', () => {
		const result = parseImportTable(
			' Nombre ,CATEGORIA,tipo_imagen\nTaza,tazas,foto\n,,\nVela,velas,foto\n'
		);
		expect(result).toEqual({
			ok: true,
			value: [
				{ line: 2, row: { nombre: 'Taza', categoria: 'tazas', tipo_imagen: 'foto' } },
				{ line: 4, row: { nombre: 'Vela', categoria: 'velas', tipo_imagen: 'foto' } }
			]
		});
	});

	it('rejects unknown and missing columns with their names', () => {
		const unknown = parseImportTable('nombre,categoria,tipo_imagen,precioo\nA,b,foto,1');
		expect(unknown).toEqual({ ok: false, message: expect.stringContaining('precioo') });
		const missing = parseImportTable('nombre,tipo_imagen\nA,foto');
		expect(missing).toEqual({ ok: false, message: expect.stringContaining('categoria') });
	});

	it('rejects repeated columns, empty files and too many rows', () => {
		expect(parseImportTable('nombre,nombre,categoria,tipo_imagen\n').ok).toBe(false);
		expect(parseImportTable('nombre,categoria,tipo_imagen\n').ok).toBe(false);
		const many = 'nombre,categoria,tipo_imagen\n' + 'a,b,foto\n'.repeat(501);
		expect(parseImportTable(many)).toEqual({
			ok: false,
			message: expect.stringContaining('500')
		});
	});

	it('reports malformed CSV instead of throwing', () => {
		expect(parseImportTable('nombre,categoria,tipo_imagen\n"abc').ok).toBe(false);
	});
});

describe('planImportRow', () => {
	it('builds a mockup product with a new design from the referenced files', () => {
		const result = plan({ ...mockup, diseno_clara: 'calavera-clara.png' });
		expect(result).toEqual({
			ok: true,
			value: {
				input: {
					product: {
						nombre: 'Playera Calavera',
						slug: 'playera-calavera',
						descripcion: '',
						category_id: CATEGORY,
						tipo_imagen: 'mockup',
						garment_type_id: PLAYERA,
						design_id: PENDING_DESIGN_ID,
						precio_base: null,
						precio_oferta: null,
						oferta_hasta: null,
						modo_stock: 'bajo_pedido',
						permite_personalizar: false,
						activo: false,
						destacado: false
					},
					colors: [NEGRO, BLANCO],
					collections: [],
					stock: []
				},
				newDesign: {
					nombre: 'Playera Calavera',
					oscura: 'calavera.png',
					clara: 'calavera-clara.png'
				},
				fotos: []
			}
		});
	});

	it('reuses an existing design by its exact name', () => {
		const result = plan({ ...mockup, diseno_oscura: '', diseno_existente: 'Calavera' });
		expect(result.ok && result.value.input.product.design_id).toBe(DESIGN);
		expect(result.ok && result.value.newDesign).toBeNull();
	});

	it('reads every optional field', () => {
		const result = plan({
			...mockup,
			slug: 'calavera-negra',
			diseno_nombre: 'Calavera v2',
			descripcion: 'Algodón',
			precio: '180',
			precio_oferta: '150.50',
			oferta_hasta: '2026-12-31',
			modo_stock: 'stock',
			stock: 'negro:M=5; Blanco Hueso:ch=2',
			colecciones: 'anime',
			permite_personalizar: 'sí',
			destacado: 'SI',
			activo: '1'
		});
		if (!result.ok) throw new Error(result.message);
		const { input, newDesign } = result.value;
		expect(input.product).toMatchObject({
			slug: 'calavera-negra',
			descripcion: 'Algodón',
			precio_base: 18000,
			precio_oferta: 15050,
			oferta_hasta: '2026-12-31',
			modo_stock: 'stock',
			permite_personalizar: true,
			destacado: true,
			activo: true
		});
		expect(newDesign?.nombre).toBe('Calavera v2');
		expect(input.collections).toEqual([ANIME]);
		expect(input.stock).toEqual([
			{ garment_base_id: NEGRO, talla: 'CH', cantidad: 0 },
			{ garment_base_id: NEGRO, talla: 'M', cantidad: 5 },
			{ garment_base_id: NEGRO, talla: 'G', cantidad: 0 },
			{ garment_base_id: BLANCO, talla: 'CH', cantidad: 2 },
			{ garment_base_id: BLANCO, talla: 'M', cantidad: 0 },
			{ garment_base_id: BLANCO, talla: 'G', cantidad: 0 }
		]);
	});

	it('builds a photo product with its photos in order', () => {
		const result = plan(foto);
		if (!result.ok) throw new Error(result.message);
		expect(result.value.input.product).toMatchObject({
			tipo_imagen: 'foto',
			garment_type_id: null,
			design_id: null,
			precio_base: 25000
		});
		expect(result.value.fotos).toEqual(['taza-1.jpg', 'taza-2.jpg']);
		expect(result.value.newDesign).toBeNull();
	});

	it('names the reference that does not exist', () => {
		expect(message({ ...mockup, categoria: 'gorras' })).toContain('gorras');
		expect(message({ ...mockup, tipo_prenda: 'Gorra' })).toContain('Gorra');
		expect(message({ ...mockup, colores: 'negro|morado' })).toContain('morado');
		expect(message({ ...mockup, colecciones: 'anime|marvel' })).toContain('marvel');
		expect(message({ ...mockup, diseno_oscura: '', diseno_existente: 'calavera' })).toContain(
			'calavera'
		);
		expect(message({ ...mockup, diseno_oscura: 'otra.png' })).toContain('otra.png');
		expect(message({ ...foto, fotos: 'taza-1.jpg|taza-9.jpg' })).toContain('taza-9.jpg');
	});

	it('does not match colors of another garment type', () => {
		expect(message({ ...mockup, tipo_prenda: 'Sudadera', colores: 'blanco hueso' })).toContain(
			'blanco hueso'
		);
	});

	it('rejects invalid enumerations and booleans instead of defaulting them', () => {
		expect(message({ ...mockup, tipo_imagen: 'video' })).toContain('tipo_imagen');
		expect(message({ ...mockup, modo_stock: 'agotado' })).toContain('modo_stock');
		expect(message({ ...mockup, activo: 'tal vez' })).toContain('activo');
	});

	it('rejects inconsistent image columns', () => {
		expect(message({ ...mockup, diseno_oscura: '' })).toContain('diseño');
		expect(message({ ...mockup, diseno_existente: 'Calavera' })).toContain('diseno_existente');
		expect(message({ ...mockup, diseno_oscura: 'calavera.jpg' })).toContain('PNG');
		expect(message({ ...mockup, fotos: 'taza-1.jpg' })).toContain('fotos');
		expect(message({ ...foto, fotos: '' })).toContain('foto');
		expect(message({ ...foto, diseno_oscura: 'calavera.png' })).toContain('diseño');
	});

	it('validates the stock column against colors and sizes', () => {
		const stock = { ...mockup, modo_stock: 'stock' };
		expect(message({ ...stock, stock: 'negro:XL=2' })).toContain('XL');
		expect(message({ ...stock, stock: 'rojo:M=2' })).toContain('rojo');
		expect(message({ ...stock, stock: 'negro:M=dos' })).toContain('stock');
		expect(message({ ...stock, stock: 'negro:M=1;negro:M=2' })).toContain('negro:M');
		expect(message({ ...mockup, stock: 'negro:M=1' })).toContain('modo_stock');
	});

	it('keeps the rules of the manual product form', () => {
		expect(message({ ...foto, precio: '' })).toContain('precio');
		expect(message({ ...mockup, precio_oferta: '200' })).toContain('oferta');
		expect(message({ ...mockup, colores: '' })).toContain('color');
		expect(message({ ...mockup, nombre: '' })).toContain('nombre');
	});

	it('rejects a slug that is already used', () => {
		expect(message({ ...mockup, slug: 'ya-existe' })).toContain('ya-existe');
	});

	it('matches image names regardless of case, folder prefix or Unicode NFD/NFC form', () => {
		const nfdFiles = new Set([normalizeFileName('imagenes/Calavéra.PNG'), 'taza-1.jpg']);
		const result = planImportRow(
			{ ...mockup, diseno_oscura: 'imagenes\\calavéra.png'.normalize('NFC') },
			catalog,
			nfdFiles
		);
		expect(result.ok && result.value.newDesign?.oscura).toBe('calavéra.png'.normalize('NFC'));

		const photoResult = planImportRow({ ...foto, fotos: 'carpeta/TAZA-1.JPG' }, catalog, nfdFiles);
		expect(photoResult.ok && photoResult.value.fotos).toEqual(['taza-1.jpg']);
	});
});

describe('designKey', () => {
	it('produces the same key for rows sharing the same design files', () => {
		const playera = {
			...mockup,
			nombre: 'Playera Calavera',
			diseno_oscura: 'Imagenes/Calavera.PNG'
		};
		const sudadera = { ...mockup, nombre: 'Sudadera Calavera', diseno_oscura: 'calavera.png' };
		expect(designKey(playera)).toBe('::calavera.png::');
		expect(designKey(sudadera)).toBe(designKey(playera));
		expect(designKey({ ...playera, diseno_nombre: 'Calavera Especial' })).toBe(
			'calavera especial::calavera.png::'
		);
		expect(designKey(foto)).toBeNull();
	});
});

describe('planImport', () => {
	it('reports each row and flags slugs repeated inside the file', () => {
		const report = planImport(
			[
				{ line: 2, row: mockup },
				{ line: 3, row: { ...mockup, diseno_oscura: 'calavera-clara.png' } },
				{ line: 4, row: { ...foto, categoria: 'nada' } }
			],
			catalog,
			files
		);
		expect(report.map((item) => [item.line, item.ok])).toEqual([
			[2, true],
			[3, false],
			[4, false]
		]);
		expect(report[1]).toMatchObject({
			slug: 'playera-calavera',
			message: expect.stringContaining('2')
		});
		expect(report[0].nombre).toBe('Playera Calavera');
	});
});

describe('rowsFromJson', () => {
	it('accepts the rows the browser sends back', () => {
		const rows = [{ line: 2, row: { nombre: 'Taza', categoria: 'tazas' } }];
		expect(rowsFromJson(JSON.stringify(rows))).toEqual(rows);
	});

	it('rejects unknown columns, non-string values and malformed JSON', () => {
		expect(rowsFromJson(JSON.stringify([{ line: 2, row: { otra: 'x' } }]))).toBeNull();
		expect(rowsFromJson(JSON.stringify([{ line: 2, row: { nombre: 1 } }]))).toBeNull();
		expect(rowsFromJson(JSON.stringify([]))).toBeNull();
		expect(rowsFromJson('{')).toBeNull();
		expect(rowsFromJson(null)).toBeNull();
	});
});
