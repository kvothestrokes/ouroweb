import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.js';
import {
	IMPORT_FIELD_DOCS,
	TEMPLATE_DESIGN,
	TEMPLATE_PHOTO,
	templateRows
} from './import-template.js';
import {
	IMPORT_COLUMNS,
	parseImportTable,
	planImport,
	type ImportCatalog
} from './product-import.js';

const catalog: ImportCatalog = {
	categories: [{ id: '11111111-1111-4111-8111-111111111111', slug: 'playeras' }],
	garmentTypes: [
		{
			id: '22222222-2222-4222-8222-222222222222',
			nombre: 'Playera',
			tallas: ['CH', 'M'],
			precio_normal: 17000
		}
	],
	bases: [
		{
			id: '44444444-4444-4444-8444-444444444444',
			garment_type_id: '22222222-2222-4222-8222-222222222222',
			color_nombre: 'Negro'
		},
		{
			id: '55555555-5555-4555-8555-555555555555',
			garment_type_id: '22222222-2222-4222-8222-222222222222',
			color_nombre: 'Blanco'
		}
	],
	collections: [{ id: '77777777-7777-4777-8777-777777777777', slug: 'anime' }],
	designs: [],
	existingSlugs: []
};

describe('templateRows', () => {
	it('produces a template that imports cleanly against the catalog it was built from', () => {
		const csv = toCsv(
			templateRows({
				categoria: 'playeras',
				coleccion: 'anime',
				prenda: { nombre: 'Playera', colores: ['Negro', 'Blanco'], talla: 'CH' }
			})
		);
		const table = parseImportTable(csv);
		if (!table.ok) throw new Error(table.message);
		const report = planImport(table.value, catalog, new Set([TEMPLATE_DESIGN, TEMPLATE_PHOTO]));
		expect(report.map((item) => (item.ok ? 'ok' : item.message))).toEqual(['ok', 'ok']);
	});

	it('omits the mockup example when there are no garments yet', () => {
		const rows = templateRows({ categoria: null, coleccion: null, prenda: null });
		expect(rows).toHaveLength(2);
		expect(rows[1]).toContain('foto');
	});

	it('documents every CSV column in the exact template order', () => {
		expect(IMPORT_FIELD_DOCS.map((doc) => doc.column)).toEqual([...IMPORT_COLUMNS]);
	});
});
