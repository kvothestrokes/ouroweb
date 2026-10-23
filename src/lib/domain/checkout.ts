import { z } from 'zod';
import type { FormResult } from './catalog.js';
import { normalizeMxPhone } from './phone.js';
import { isSlug } from './slug.js';

export const DELIVERY_METHODS = [
	{ value: 'recoger', label: 'Recoger en el taller' },
	{ value: 'domicilio', label: 'Entrega a domicilio (local)' },
	{ value: 'paqueteria', label: 'Paquetería nacional' }
] as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]['value'];

export function deliveryLabel(method: DeliveryMethod): string {
	return DELIVERY_METHODS.find((option) => option.value === method)?.label ?? method;
}

export const MAX_ITEMS = 30;
export const MAX_QUANTITY = 99;

// Control and bidi-override characters could fake lines in the WhatsApp message or in the panel.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Free text from customers: no control characters; one line unless `multiline`. */
export function cleanText(value: string, multiline = false): string {
	const normalized = value.replace(/\r\n?/g, '\n');
	const flat = multiline ? normalized : normalized.replace(/\n+/g, ' ');
	return flat
		.replace(CONTROL, '')
		.replace(/[ \t]+/g, ' ')
		.trim();
}

const text = (max: number, { multiline = false, min = 0 } = {}) =>
	z
		.string()
		.transform((value) => cleanText(value, multiline))
		.pipe(z.string().min(min).max(max));

const addressSchema = z.object({
	calle: text(120, { min: 1 }),
	colonia: text(80, { min: 1 }),
	cp: z
		.string()
		.trim()
		.regex(/^\d{5}$/),
	ciudad: text(80, { min: 1 }),
	estado: text(60, { min: 1 }),
	referencias: text(200).default('')
});

export type Address = z.infer<typeof addressSchema>;

const itemSchema = z.object({
	slug: z.string().refine(isSlug),
	color: z.string().refine(isSlug).nullable(),
	talla: z
		.string()
		.regex(/^[A-Z0-9]{1,5}$/)
		.nullable(),
	cantidad: z.number().int().min(1).max(MAX_QUANTITY),
	personalizacion: text(500)
		.nullable()
		.transform((value) => value || null)
});

export type CheckoutItem = z.infer<typeof itemSchema>;

/** Who orders and how it is delivered (shared by checkout and special requests). */
export type Contact = {
	nombre: string;
	/** `52XXXXXXXXXX`. */
	whatsapp: string;
	metodoEntrega: DeliveryMethod;
	direccion: Address | null;
	notas: string;
};

export type Checkout = Contact & { items: CheckoutItem[] };

const contactSchema = z.object({
	nombre: text(80),
	whatsapp: z.string().max(30),
	metodoEntrega: z.enum(['recoger', 'domicilio', 'paqueteria']),
	direccion: z.unknown().optional(),
	notas: text(500, { multiline: true }).default('')
});

export function parseContact(input: unknown): FormResult<Contact> {
	const base = contactSchema.safeParse(input);
	if (!base.success) return { ok: false, message: 'Revisa tus datos de contacto y entrega.' };
	const data = base.data;

	if (!data.nombre) return { ok: false, message: 'Escribe tu nombre.' };
	const whatsapp = normalizeMxPhone(data.whatsapp);
	if (!whatsapp) return { ok: false, message: 'Escribe tu WhatsApp a 10 dígitos.' };

	let direccion: Address | null = null;
	if (data.metodoEntrega !== 'recoger') {
		const address = addressSchema.safeParse(data.direccion);
		if (!address.success) return { ok: false, message: 'Completa tu dirección de entrega.' };
		direccion = address.data;
	}
	return {
		ok: true,
		value: {
			nombre: data.nombre,
			whatsapp,
			metodoEntrega: data.metodoEntrega,
			direccion,
			notas: data.notas
		}
	};
}

const itemsSchema = z.object({ items: z.array(z.unknown()).max(MAX_ITEMS) });

/** Validates the checkout payload sent by the browser (spec 6.1, step 3). */
export function parseCheckout(input: unknown): FormResult<Checkout> {
	const contact = parseContact(input);
	if (!contact.ok) {
		return contact.message === 'Revisa tus datos de contacto y entrega.'
			? { ok: false, message: 'Revisa los datos de tu pedido.' }
			: contact;
	}
	const list = itemsSchema.safeParse(input);
	if (!list.success) return { ok: false, message: 'Revisa los datos de tu pedido.' };
	if (!list.data.items.length) return { ok: false, message: 'Tu carrito está vacío.' };

	const items = z.array(itemSchema).safeParse(list.data.items);
	if (!items.success) return { ok: false, message: 'Revisa los productos de tu carrito.' };

	return { ok: true, value: { ...contact.value, items: items.data } };
}
