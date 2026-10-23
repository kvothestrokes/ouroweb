import { z } from 'zod';
import { SLUG_MESSAGE, type FormResult } from './catalog.js';
import { formatMoney, parseMoney } from './money.js';
import { isSlug, slugify } from './slug.js';

export type ProductRecord = {
	nombre: string;
	slug: string;
	descripcion: string;
	category_id: string;
	tipo_imagen: 'mockup' | 'foto';
	garment_type_id: string | null;
	design_id: string | null;
	/** Cents; null inherits the garment type price. */
	precio_base: number | null;
	/** Cents; null = no offer. */
	precio_oferta: number | null;
	/** `YYYY-MM-DD` (inclusive); null = no end. */
	oferta_hasta: string | null;
	modo_stock: 'stock' | 'bajo_pedido';
	permite_personalizar: boolean;
	activo: boolean;
	destacado: boolean;
};

export type StockEntry = { garment_base_id: string; talla: string; cantidad: number };

export type ProductInput = {
	product: ProductRecord;
	/** Garment bases the product comes in, in the order picked. */
	colors: string[];
	collections: string[];
	stock: StockEntry[];
};

export type ProductContext = {
	garmentTypes: { id: string; tallas: string[]; precio_normal: number | null }[];
	bases: { id: string; garment_type_id: string }[];
};

const uuid = z.uuid();

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

function ids(form: FormData, name: string): string[] {
	const values = form
		.getAll(name)
		.filter((value): value is string => typeof value === 'string' && uuid.safeParse(value).success);
	return [...new Set(values)];
}

function optionalId(form: FormData, name: string): string | null {
	const value = text(form, name);
	return value && uuid.safeParse(value).success ? value : null;
}

/** Stock fields are named `stock.<garment_base_id>.<talla>`; empty means 0. */
function stockCount(form: FormData, baseId: string, talla: string): number | null {
	const raw = text(form, `stock.${baseId}.${talla}`);
	if (raw === '') return 0;
	return /^\d{1,4}$/.test(raw) ? Number(raw) : null;
}

/**
 * Reads the product form (spec section 4 and 10). Mockup products need a garment type,
 * a design and at least one color; products that are not garments need their own price
 * and are always made to order (stock is tracked per color and size).
 */
export function productFromForm(form: FormData, context: ProductContext): FormResult<ProductInput> {
	const nombre = text(form, 'nombre');
	if (!nombre || nombre.length > 80)
		return { ok: false, message: 'Escribe el nombre del producto.' };

	const slug = text(form, 'slug') || slugify(nombre);
	if (!isSlug(slug)) return { ok: false, message: SLUG_MESSAGE };

	const descripcion = text(form, 'descripcion');
	if (descripcion.length > 2000) {
		return { ok: false, message: 'La descripción es muy larga (máximo 2000 caracteres).' };
	}

	const category_id = optionalId(form, 'category_id');
	if (!category_id) return { ok: false, message: 'Elige la categoría.' };

	const tipo = text(form, 'tipo_imagen');
	if (tipo !== 'mockup' && tipo !== 'foto') {
		return { ok: false, message: 'Elige cómo se muestra el producto.' };
	}

	const garmentTypeId = optionalId(form, 'garment_type_id');
	const garmentType = context.garmentTypes.find((type) => type.id === garmentTypeId) ?? null;
	const designId = optionalId(form, 'design_id');
	if (tipo === 'mockup') {
		if (!garmentType) return { ok: false, message: 'Elige el tipo de prenda del mockup.' };
		if (!designId) return { ok: false, message: 'Elige el diseño del mockup.' };
	}

	const colors = garmentType ? ids(form, 'colores') : [];
	const typeOf = new Map(context.bases.map((base) => [base.id, base.garment_type_id]));
	if (colors.some((id) => typeOf.get(id) !== garmentType?.id)) {
		return { ok: false, message: 'Hay colores que no son de esta prenda.' };
	}
	if (tipo === 'mockup' && colors.length === 0) {
		return { ok: false, message: 'Elige al menos un color.' };
	}

	const precio_base = parseMoney(form.get('precio'));
	if (Number.isNaN(precio_base)) return { ok: false, message: 'Revisa el precio.' };
	if (precio_base === null && !garmentType) {
		return { ok: false, message: 'Escribe el precio: este producto no es una prenda.' };
	}

	const precio_oferta = parseMoney(form.get('precio_oferta'));
	if (Number.isNaN(precio_oferta)) return { ok: false, message: 'Revisa el precio de oferta.' };
	const regular = precio_base ?? garmentType?.precio_normal ?? null;
	if (precio_oferta !== null && regular !== null && precio_oferta >= regular) {
		return {
			ok: false,
			message: `La oferta debe ser menor que el precio normal (${formatMoney(regular)}).`
		};
	}
	const oferta_hasta = text(form, 'oferta_hasta') || null;
	if (oferta_hasta && precio_oferta === null) {
		return { ok: false, message: 'Escribe el precio de oferta o quita la fecha.' };
	}
	if (
		oferta_hasta &&
		(!/^\d{4}-\d{2}-\d{2}$/.test(oferta_hasta) || Number.isNaN(Date.parse(oferta_hasta)))
	) {
		return { ok: false, message: 'Revisa la fecha de fin de la oferta.' };
	}

	const modo_stock = text(form, 'modo_stock') === 'stock' ? 'stock' : 'bajo_pedido';
	const stock: StockEntry[] = [];
	if (modo_stock === 'stock') {
		if (!garmentType) {
			return {
				ok: false,
				message: 'El inventario por color y talla solo aplica a prendas; usa «Bajo pedido».'
			};
		}
		for (const garment_base_id of colors) {
			for (const talla of garmentType.tallas) {
				const cantidad = stockCount(form, garment_base_id, talla);
				if (cantidad === null)
					return { ok: false, message: 'Revisa las cantidades del inventario.' };
				stock.push({ garment_base_id, talla, cantidad });
			}
		}
	}

	return {
		ok: true,
		value: {
			product: {
				nombre,
				slug,
				descripcion,
				category_id,
				tipo_imagen: tipo,
				garment_type_id: garmentType?.id ?? null,
				design_id: tipo === 'mockup' ? designId : null,
				precio_base,
				precio_oferta,
				oferta_hasta,
				modo_stock,
				permite_personalizar: form.get('permite_personalizar') === 'on',
				activo: form.get('activo') === 'on',
				destacado: form.get('destacado') === 'on'
			},
			colors,
			collections: ids(form, 'colecciones'),
			stock
		}
	};
}
