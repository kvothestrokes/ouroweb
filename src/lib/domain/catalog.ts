import { z } from 'zod';
import { isSlug, slugify } from './slug.js';

export type FormResult<T> = { ok: true; value: T } | { ok: false; message: string };

export type CategoryInput = {
	nombre: string;
	slug: string;
	parent_id: string | null;
	orden: number;
	activo: boolean;
	es_estrella: boolean;
};

export type CollectionInput = { nombre: string; slug: string };

export type CategoryRow = CategoryInput & { id: string };

export type CategoryTree = (CategoryRow & { children: CategoryRow[] })[];

const SLUG_MESSAGE =
	'El slug solo puede tener minúsculas, números y guiones (ej. playeras-con-diseno).';

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

/** Explicit slug, or the one derived from the name when the field is empty. */
function slugField(form: FormData, nombre: string): FormResult<string> {
	const slug = text(form, 'slug') || slugify(nombre);
	return isSlug(slug) ? { ok: true, value: slug } : { ok: false, message: SLUG_MESSAGE };
}

const orden = z.coerce.number().int().min(0).max(999);

export function categoryFromForm(form: FormData): FormResult<CategoryInput> {
	const nombre = text(form, 'nombre');
	if (!nombre || nombre.length > 60) {
		return { ok: false, message: 'Escribe el nombre de la categoría.' };
	}
	const slug = slugField(form, nombre);
	if (!slug.ok) return slug;

	const parent = text(form, 'parent_id');
	if (parent && !z.uuid().safeParse(parent).success) {
		return { ok: false, message: 'Revisa la categoría padre.' };
	}

	const order = orden.safeParse(text(form, 'orden') || '0');
	if (!order.success)
		return { ok: false, message: 'El orden debe ser un número entero de 0 a 999.' };

	return {
		ok: true,
		value: {
			nombre,
			slug: slug.value,
			parent_id: parent || null,
			orden: order.data,
			activo: form.get('activo') === 'on',
			es_estrella: form.get('es_estrella') === 'on'
		}
	};
}

type Placement = { id: string | null; parent_id: string | null; es_estrella?: boolean };
type Existing = { id: string; parent_id: string | null };

/**
 * Two-level taxonomy (spec section 4.1): roots hold subcategories, and only a subcategory
 * can be its parent's star. Returns the problem to show, or null when the placement is valid.
 */
export function checkCategoryPlacement(category: Placement, existing: Existing[]): string | null {
	const { id, parent_id, es_estrella = false } = category;
	if (parent_id) {
		if (parent_id === id) return 'Una categoría no puede ser su propia categoría padre.';
		const parent = existing.find((item) => item.id === parent_id);
		if (!parent) return 'Revisa la categoría padre.';
		if (parent.parent_id) return 'Solo puedes colgar subcategorías de una categoría principal.';
		if (id && existing.some((item) => item.parent_id === id)) {
			return 'Esta categoría tiene subcategorías, así que debe seguir siendo principal.';
		}
	} else if (es_estrella) {
		return 'Solo una subcategoría puede ser la estrella de su categoría.';
	}
	return null;
}

export function collectionFromForm(form: FormData): FormResult<CollectionInput> {
	const nombre = text(form, 'nombre');
	if (!nombre || nombre.length > 60) {
		return { ok: false, message: 'Escribe el nombre de la colección.' };
	}
	const slug = slugField(form, nombre);
	return slug.ok ? { ok: true, value: { nombre, slug: slug.value } } : slug;
}
