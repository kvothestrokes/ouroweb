import { describe, expect, it } from 'vitest';
import { categoryFromForm, checkCategoryPlacement, collectionFromForm } from './catalog.js';

function form(values: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(values)) data.set(key, value);
	return data;
}

const ROPA = '11111111-1111-4111-8111-111111111111';
const PLAYERAS = '22222222-2222-4222-8222-222222222222';

describe('categoryFromForm', () => {
	it('reads a subcategory, deriving the slug from the name when it is empty', () => {
		expect(
			categoryFromForm(
				form({ nombre: 'Playeras con diseño', slug: '', parent_id: ROPA, orden: '2' })
			)
		).toEqual({
			ok: true,
			value: {
				nombre: 'Playeras con diseño',
				slug: 'playeras-con-diseno',
				parent_id: ROPA,
				orden: 2,
				activo: false,
				es_estrella: false
			}
		});
	});

	it('reads checkboxes and a root category', () => {
		const result = categoryFromForm(
			form({ nombre: 'Velas', slug: 'velas', parent_id: '', orden: '', activo: 'on' })
		);
		expect(result).toEqual({
			ok: true,
			value: {
				nombre: 'Velas',
				slug: 'velas',
				parent_id: null,
				orden: 0,
				activo: true,
				es_estrella: false
			}
		});
	});

	it('explains what is wrong', () => {
		expect(categoryFromForm(form({ nombre: '', slug: 'x' }))).toEqual({
			ok: false,
			message: 'Escribe el nombre de la categoría.'
		});
		expect(categoryFromForm(form({ nombre: 'Velas', slug: 'Velas Ricas' }))).toEqual({
			ok: false,
			message: 'El slug solo puede tener minúsculas, números y guiones (ej. playeras-con-diseno).'
		});
		expect(categoryFromForm(form({ nombre: 'Velas', slug: '', parent_id: 'abc' }))).toEqual({
			ok: false,
			message: 'Revisa la categoría padre.'
		});
		expect(categoryFromForm(form({ nombre: 'Velas', slug: '', orden: '-1' }))).toEqual({
			ok: false,
			message: 'El orden debe ser un número entero de 0 a 999.'
		});
	});
});

describe('checkCategoryPlacement', () => {
	const categories = [
		{ id: ROPA, parent_id: null },
		{ id: PLAYERAS, parent_id: ROPA }
	];

	it('allows roots and subcategories of a root', () => {
		expect(
			checkCategoryPlacement({ id: null, parent_id: null, es_estrella: false }, categories)
		).toBeNull();
		expect(
			checkCategoryPlacement({ id: null, parent_id: ROPA, es_estrella: true }, categories)
		).toBeNull();
	});

	it('keeps the taxonomy at two levels', () => {
		expect(
			checkCategoryPlacement({ id: null, parent_id: PLAYERAS, es_estrella: false }, categories)
		).toBe('Solo puedes colgar subcategorías de una categoría principal.');
		expect(
			checkCategoryPlacement({ id: ROPA, parent_id: ROPA, es_estrella: false }, categories)
		).toBe('Una categoría no puede ser su propia categoría padre.');
		const otherRoot = '33333333-3333-4333-8333-333333333333';
		expect(
			checkCategoryPlacement({ id: ROPA, parent_id: otherRoot }, [
				...categories,
				{ id: otherRoot, parent_id: null }
			])
		).toBe('Esta categoría tiene subcategorías, así que debe seguir siendo principal.');
	});

	it('only lets subcategories be the star', () => {
		expect(
			checkCategoryPlacement({ id: null, parent_id: null, es_estrella: true }, categories)
		).toBe('Solo una subcategoría puede ser la estrella de su categoría.');
	});

	it('rejects a parent that does not exist', () => {
		expect(
			checkCategoryPlacement(
				{ id: null, parent_id: '44444444-4444-4444-8444-444444444444', es_estrella: false },
				categories
			)
		).toBe('Revisa la categoría padre.');
	});
});

describe('collectionFromForm', () => {
	it('reads a collection and derives its slug', () => {
		expect(collectionFromForm(form({ nombre: 'Dragon Ball', slug: '' }))).toEqual({
			ok: true,
			value: { nombre: 'Dragon Ball', slug: 'dragon-ball' }
		});
	});

	it('rejects an empty name', () => {
		expect(collectionFromForm(form({ nombre: '  ', slug: '' }))).toEqual({
			ok: false,
			message: 'Escribe el nombre de la colección.'
		});
	});
});
