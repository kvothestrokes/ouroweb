import { z } from 'zod';
import type { FormResult } from './catalog.js';
import { cleanText, parseContact, type Contact } from './checkout.js';
import { parseMoney } from './money.js';

export type CustomRequestTypeInput = {
	nombre: string;
	/** Cents; null = "por cotizar". */
	precio_desde: number | null;
	activo: boolean;
};

function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

export function customRequestTypeFromForm(form: FormData): FormResult<CustomRequestTypeInput> {
	const nombre = text(form, 'nombre');
	if (!nombre || nombre.length > 60) {
		return { ok: false, message: 'Escribe el nombre del tipo de encargo.' };
	}
	const precio = parseMoney(text(form, 'precio_desde'));
	if (Number.isNaN(precio)) {
		return { ok: false, message: 'Escribe el precio «desde» en pesos (ej. 250).' };
	}
	return { ok: true, value: { nombre, precio_desde: precio, activo: form.get('activo') === 'on' } };
}

export type CustomRequestInput = {
	custom_request_type_id: string | null;
	descripcion: string;
	cantidad: number;
	/** `YYYY-MM-DD`, or null when the customer has no date. */
	fecha_deseada: string | null;
};

export const MAX_REFERENCE_IMAGES = 3;

/** Today in Mexico City as `YYYY-MM-DD`. */
function localDate(now: Date): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
}

/** The special request form (spec 6.2); reference images are handled by the server. */
export function customRequestFromForm(
	form: FormData,
	now = new Date()
): FormResult<{ request: CustomRequestInput; contact: Contact }> {
	const tipo = text(form, 'tipo');
	if (tipo && !z.uuid().safeParse(tipo).success) {
		return { ok: false, message: 'Elige el tipo de encargo.' };
	}

	const descripcion = cleanText(text(form, 'descripcion'), true);
	if (!descripcion) return { ok: false, message: 'Cuéntanos qué te gustaría que hiciéramos.' };
	if (descripcion.length > 1000) {
		return { ok: false, message: 'La descripción es muy larga (máximo 1000 caracteres).' };
	}

	const cantidad = Number(text(form, 'cantidad') || '1');
	if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
		return { ok: false, message: 'La cantidad debe ser de 1 a 999 piezas.' };
	}

	const fecha = text(form, 'fecha_deseada');
	if (fecha) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
			return { ok: false, message: 'Revisa la fecha deseada.' };
		}
		if (fecha < localDate(now)) {
			return { ok: false, message: 'La fecha deseada debe ser de hoy en adelante.' };
		}
	}

	const metodoEntrega = text(form, 'metodoEntrega');
	const contact = parseContact({
		nombre: text(form, 'nombre'),
		whatsapp: text(form, 'whatsapp'),
		metodoEntrega,
		notas: '',
		direccion:
			metodoEntrega === 'recoger'
				? undefined
				: {
						calle: text(form, 'calle'),
						colonia: text(form, 'colonia'),
						cp: text(form, 'cp'),
						ciudad: text(form, 'ciudad'),
						estado: text(form, 'estado'),
						referencias: text(form, 'referencias_domicilio')
					}
	});
	if (!contact.ok) {
		return contact.message === 'Revisa tus datos de contacto y entrega.'
			? { ok: false, message: 'Elige cómo quieres recibir tu encargo.' }
			: contact;
	}

	return {
		ok: true,
		value: {
			request: {
				custom_request_type_id: tipo || null,
				descripcion,
				cantidad,
				fecha_deseada: fecha || null
			},
			contact: contact.value
		}
	};
}
