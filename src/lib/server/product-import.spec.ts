import { describe, expect, it, vi } from 'vitest';
import { PENDING_DESIGN_ID, type ImportPlan } from '#lib/domain/product-import.js';
import type { ProductRecord } from '#lib/domain/product.js';
import { importPlannedRow, type ImportDeps } from './product-import.js';

vi.mock('./imagekit.js', () => ({ deleteImageByPath: vi.fn() }));
vi.mock('./designs.js', () => ({ storeDesignFile: vi.fn() }));
vi.mock('./product-photos.js', () => ({ storeProductPhoto: vi.fn() }));

const product = {
	nombre: 'Playera',
	slug: 'playera',
	tipo_imagen: 'mockup',
	design_id: PENDING_DESIGN_ID
} as ProductRecord;

const mockupPlan: ImportPlan = {
	input: { product, colors: ['b1'], collections: [], stock: [] },
	newDesign: { nombre: 'Calavera', oscura: 'o.png', clara: 'c.png' },
	fotos: []
};

const photoPlan: ImportPlan = {
	input: {
		product: { ...product, tipo_imagen: 'foto', design_id: null },
		colors: [],
		collections: [],
		stock: []
	},
	newDesign: null,
	fotos: ['a.jpg', 'b.jpg']
};

const files = new Map(
	['o.png', 'c.png', 'a.jpg', 'b.jpg'].map((name) => [name, new File(['x'], name)])
);

function deps(overrides: Partial<ImportDeps> = {}): ImportDeps & { calls: string[] } {
	const calls: string[] = [];
	const base: ImportDeps = {
		storeDesignFile: async (file) => {
			calls.push(`design:${file.name}`);
			return { ok: true, path: `/d/${file.name}` };
		},
		storeProductPhoto: async (file) => {
			calls.push(`photo:${file.name}`);
			return { ok: true, path: `/p/${file.name}` };
		},
		insertDesign: async (row) => {
			calls.push(`insertDesign:${row.nombre}:${row.path_prenda_oscura}:${row.path_prenda_clara}`);
			return 'design-1';
		},
		saveProduct: async (input) => {
			calls.push(`save:${input.product.design_id}`);
			return { ok: true, id: 'product-1' };
		},
		insertImages: async (id, paths) => {
			calls.push(`images:${id}:${paths.join(',')}`);
			return true;
		},
		deleteProduct: async (id) => void calls.push(`deleteProduct:${id}`),
		deleteDesign: async (id) => void calls.push(`deleteDesign:${id}`),
		deleteImage: async (path) => void calls.push(`deleteImage:${path}`)
	};
	return Object.assign({ ...base, ...overrides }, { calls });
}

describe('importPlannedRow', () => {
	it('uploads the design, creates it and links the product to the real id', async () => {
		const d = deps();
		expect(await importPlannedRow(mockupPlan, files, d)).toEqual({
			ok: true,
			id: 'product-1',
			designId: 'design-1'
		});
		expect(d.calls).toEqual([
			'design:o.png',
			'design:c.png',
			'insertDesign:Calavera:/d/o.png:/d/c.png',
			'save:design-1'
		]);
	});

	it('reuses a design already created earlier in the same import batch without re-uploading', async () => {
		const d = deps();
		expect(await importPlannedRow(mockupPlan, new Map(), d, 'design-shared')).toEqual({
			ok: true,
			id: 'product-1',
			designId: 'design-shared'
		});
		expect(d.calls).toEqual(['save:design-shared']);
	});

	it('uploads photos in order and stores them after the product', async () => {
		const d = deps();
		expect(await importPlannedRow(photoPlan, files, d)).toEqual({
			ok: true,
			id: 'product-1',
			designId: null
		});
		expect(d.calls).toEqual([
			'photo:a.jpg',
			'photo:b.jpg',
			'save:null',
			'images:product-1:/p/a.jpg,/p/b.jpg'
		]);
	});

	it('removes uploaded files when a later file is invalid', async () => {
		const d = deps({
			storeDesignFile: async (file) =>
				file.name === 'c.png'
					? { ok: false, message: 'El PNG no tiene fondo transparente.' }
					: { ok: true, path: `/d/${file.name}` }
		});
		expect(await importPlannedRow(mockupPlan, files, d)).toEqual({
			ok: false,
			message: 'c.png: El PNG no tiene fondo transparente.'
		});
		expect(d.calls).toEqual(['deleteImage:/d/o.png']);
	});

	it('removes the design row and files when the product cannot be saved', async () => {
		const d = deps({ saveProduct: async () => ({ ok: false, message: 'Ya existe.' }) });
		expect(await importPlannedRow(mockupPlan, files, d)).toEqual({
			ok: false,
			message: 'Ya existe.'
		});
		expect(d.calls).toEqual([
			'design:o.png',
			'design:c.png',
			'insertDesign:Calavera:/d/o.png:/d/c.png',
			'deleteDesign:design-1',
			'deleteImage:/d/o.png',
			'deleteImage:/d/c.png'
		]);
	});

	it('removes the files when the design row cannot be inserted', async () => {
		const d = deps({ insertDesign: async () => null });
		const result = await importPlannedRow(mockupPlan, files, d);
		expect(result.ok).toBe(false);
		expect(d.calls).toEqual([
			'design:o.png',
			'design:c.png',
			'deleteImage:/d/o.png',
			'deleteImage:/d/c.png'
		]);
	});

	it('removes the product and photos when the photo rows cannot be stored', async () => {
		const d = deps({ insertImages: async () => false });
		const result = await importPlannedRow(photoPlan, files, d);
		expect(result.ok).toBe(false);
		expect(d.calls.slice(-3)).toEqual([
			'deleteProduct:product-1',
			'deleteImage:/p/a.jpg',
			'deleteImage:/p/b.jpg'
		]);
	});

	it('fails without side effects when a referenced file was not sent', async () => {
		const d = deps();
		const result = await importPlannedRow(mockupPlan, new Map([['o.png', files.get('o.png')!]]), d);
		expect(result).toEqual({ ok: false, message: 'Falta el archivo «c.png».' });
		expect(d.calls).toEqual([]);
	});
});
