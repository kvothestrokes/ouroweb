import { z } from 'zod';
import type { FormResult } from './catalog.js';
import { cleanText, parseContact, type Contact } from './checkout.js';
import type { CustomRequestInput } from './custom-request.js';
import { parseMoney } from './money.js';
import { normalizeMxPhone } from './phone.js';
import { isSlug, slugify } from './slug.js';

export type B2bGuarantee = {
	titulo: string;
	descripcion: string;
};

export type B2bVolumeBracket = {
	min: number;
	/** Unit price in cents (MXN). */
	precio_unitario: number;
	etiqueta: string;
};

export type B2bSimulatorLine = {
	id: string;
	nombre: string;
	unidad: string;
	/** Retail unit price in cents (anchor price). */
	precio_normal: number;
	escalas: B2bVolumeBracket[];
};

export type B2bFaq = {
	pregunta: string;
	respuesta: string;
};

export type B2bSettings = {
	badge_texto: string;
	hero_titulo: string;
	hero_subtitulo: string;
	stat_piezas_entregadas: string;
	stat_tiempo_respuesta: string;
	stat_minimo_piezas: string;
	garantias: B2bGuarantee[];
	escalas_simulador: B2bSimulatorLine[];
	faqs: B2bFaq[];
};

export type B2bPackage = {
	id: string;
	slug: string;
	nombre: string;
	subtitulo: string;
	descripcion: string;
	incluye: string[];
	/** Starting unit price in cents. */
	precio_desde: number;
	cantidad_minima: number;
	imagekit_path: string | null;
	destacado: boolean;
	activo: boolean;
	orden: number;
	updated_at: string;
};

export type B2bPortfolioItem = {
	id: string;
	titulo: string;
	giro_empresa: string;
	imagekit_path: string;
	activo: boolean;
	orden: number;
	updated_at: string;
};

export type B2bLogoSurface = 'dark' | 'light';

export type B2bProspect = {
	id: string;
	slug: string;
	empresa: string;
	contacto: string | null;
	whatsapp: string | null;
	paquete_slug: string | null;
	nota: string | null;
	logo_imagekit_path: string | null;
	logo_fondo_sugerido: B2bLogoSurface;
	activo: boolean;
	created_at: string;
	updated_at: string;
};

export const DEFAULT_B2B_SETTINGS: B2bSettings = {
	badge_texto: 'División Corporativa · Mayoreo y Personalización',
	hero_titulo: 'Tu marca en piezas que tu equipo y clientes sí van a conservar.',
	hero_subtitulo:
		'Uniformes, termos grabados en láser, tazas sublimadas, reconocimientos 3D y kits de bienvenida hechos en taller con control de calidad pieza por pieza.',
	stat_piezas_entregadas: '+1,500 piezas entregadas',
	stat_tiempo_respuesta: 'Cotización en < 2 horas',
	stat_minimo_piezas: 'Desde 10 piezas por lote',
	garantias: [
		{
			titulo: 'Mockup digital sin costo antes de producir',
			descripcion:
				'Preparamos una vista previa con tu logotipo sobre la prenda, termo o pieza real para que apruebes proporciones y colores con total certeza.'
		},
		{
			titulo: 'Compromiso de entrega con folio en vivo',
			descripcion:
				'Sabemos que un evento o ingreso de personal no puede esperar. Tu pedido lleva un folio único (OUR-AAMM-NNNN) para consultar su avance en todo momento.'
		},
		{
			titulo: 'Esquema 50/50 con evidencia fotográfica',
			descripcion:
				'Iniciamos producción con el 50% de anticipo y liquidas el resto cuando te enviamos fotos y video de tu lote terminado.'
		}
	],
	escalas_simulador: [
		{
			id: 'playeras',
			nombre: 'Playeras estampadas con tu logo',
			unidad: 'playera',
			precio_normal: 17000,
			escalas: [
				{ min: 10, precio_unitario: 15000, etiqueta: '10 a 24 pzas' },
				{ min: 25, precio_unitario: 14000, etiqueta: '25 a 49 pzas' },
				{ min: 50, precio_unitario: 13000, etiqueta: '50 a 99 pzas' },
				{ min: 100, precio_unitario: 12000, etiqueta: '100+ pzas' }
			]
		},
		{
			id: 'termos',
			nombre: 'Termos con grabado láser permanente',
			unidad: 'termo',
			precio_normal: 28000,
			escalas: [
				{ min: 10, precio_unitario: 24500, etiqueta: '10 a 24 pzas' },
				{ min: 25, precio_unitario: 22500, etiqueta: '25 a 49 pzas' },
				{ min: 50, precio_unitario: 20500, etiqueta: '50 a 99 pzas' },
				{ min: 100, precio_unitario: 19000, etiqueta: '100+ pzas' }
			]
		},
		{
			id: 'tazas',
			nombre: 'Tazas sublimadas a todo color',
			unidad: 'taza',
			precio_normal: 11000,
			escalas: [
				{ min: 10, precio_unitario: 9000, etiqueta: '10 a 24 pzas' },
				{ min: 25, precio_unitario: 8000, etiqueta: '25 a 49 pzas' },
				{ min: 50, precio_unitario: 7200, etiqueta: '50 a 99 pzas' },
				{ min: 100, precio_unitario: 6500, etiqueta: '100+ pzas' }
			]
		},
		{
			id: 'kits',
			nombre: 'Kit corporativo (Playera + Termo o Taza + Stickers)',
			unidad: 'kit',
			precio_normal: 42000,
			escalas: [
				{ min: 10, precio_unitario: 36500, etiqueta: '10 a 24 kits' },
				{ min: 25, precio_unitario: 34000, etiqueta: '25 a 49 kits' },
				{ min: 50, precio_unitario: 31500, etiqueta: '50 a 99 kits' },
				{ min: 100, precio_unitario: 29500, etiqueta: '100+ kits' }
			]
		}
	],
	faqs: [
		{
			pregunta: '¿Cuál es el pedido mínimo para precios de empresa?',
			respuesta:
				'A partir de 10 piezas del mismo producto o paquete aplicamos tarifa corporativa. También puedes combinar tallas sin costo adicional dentro del mismo lote.'
		},
		{
			pregunta: '¿En qué formato debo enviar mi logotipo?',
			respuesta:
				'De preferencia en PNG con fondo transparente, PDF editable, SVG o AI. Si solo tienes tu logo en JPG o captura, nuestro taller te ayuda a limpiarlo y prepararlo para impresión o grabado láser.'
		},
		{
			pregunta: '¿Cuánto tiempo tarda la producción de un lote empresarial?',
			respuesta:
				'Un lote de 10 a 50 piezas toma entre 3 y 6 días hábiles a partir de la aprobación del mockup digital y el anticipo. Si tienes una fecha de evento urgente, indícala en el formulario para asignarte prioridad en taller.'
		},
		{
			pregunta: '¿Hacen envíos a todo México o entregas locales?',
			respuesta:
				'Sí: puedes recoger sin costo en nuestro taller en Chiapas, pedir entrega a domicilio local o envío por paquetería nacional con número de guía rastreable.'
		}
	]
};

export const DEFAULT_B2B_PACKAGES: B2bPackage[] = [
	{
		id: 'default-uniformes',
		slug: 'uniformes-equipo',
		nombre: 'Pack Uniformes y Staff',
		subtitulo: 'Identidad impecable para restaurantes, cafeterías, gimnasios y comercios',
		descripcion:
			'Playeras y sudaderas de algodón con el logotipo de tu negocio al frente y gráfico o eslogan en espalda. Puedes mezclar tallas (CH a XXG) y colores dentro de tu lote.',
		incluye: [
			'Playera 100% algodón peso completo con estampado de alta durabilidad',
			'Combinación libre de tallas sin mínimo por talla',
			'Mockup digital previo con tu logotipo en pecho y espalda',
			'Opción de agregar nombre individual por colaborador'
		],
		precio_desde: 13000,
		cantidad_minima: 10,
		imagekit_path: null,
		destacado: true,
		activo: true,
		orden: 1,
		updated_at: '2026-11-04T00:00:00Z'
	},
	{
		id: 'default-onboarding',
		slug: 'kit-onboarding',
		nombre: 'Kit Bienvenida / Onboarding',
		subtitulo: 'Haz que cada nuevo integrante o cliente VIP recuerde su primer día',
		descripcion:
			'Un paquete listo para entregar en escritorio o evento corporativo: combina textil, bebida térmica o cerámica y detalles personalizados con la identidad de tu empresa.',
		incluye: [
			'Playera personalizada con el arte o logo de tu marca',
			'Termo grabado con láser o taza sublimada (con opción de nombre individual)',
			'Planilla de stickers en vinil de corte (Cricut) resistentes al agua',
			'Presentación cuidada lista para entregar'
		],
		precio_desde: 31500,
		cantidad_minima: 10,
		imagekit_path: null,
		destacado: true,
		activo: true,
		orden: 2,
		updated_at: '2026-11-04T00:00:00Z'
	},
	{
		id: 'default-termos',
		slug: 'termos-grabado-laser',
		nombre: 'Termos y Regalos Ejecutivos en Láser',
		subtitulo: 'Un obsequio duradero que no se borra ni se despinta con el uso diario',
		descripcion:
			'El grabado láser revela el acero inoxidable debajo del acabado mate, logrando un contraste elegante y permanente para clientes, socios, congresos o aniversarios.',
		incluye: [
			'Grabado láser de precisión con tu logotipo institucional',
			'Posibilidad de personalizar cada pieza con el nombre del destinatario',
			'Acabado permanente que no se desprende con lavadas',
			'Empaque seguro para envío local o nacional'
		],
		precio_desde: 19000,
		cantidad_minima: 10,
		imagekit_path: null,
		destacado: false,
		activo: true,
		orden: 3,
		updated_at: '2026-11-04T00:00:00Z'
	},
	{
		id: 'default-eventos',
		slug: 'eventos-impresion-3d-promocionales',
		nombre: 'Eventos, Expos y Piezas 3D / Láser',
		subtitulo: 'Trofeos, llaveros, porta-reconocimientos, tazas y señalética para tu marca',
		descripcion:
			'Fabricamos piezas únicas que no encuentras en catálogos genéricos: desde llaveros volumétricos en impresión 3D y reconocimientos en corte láser hasta tazas y mousepads sublimados.',
		incluye: [
			'Diseño y modelado adaptado al isotipo de tu empresa',
			'Reconocimientos, llaveros 3D, tazas, playmats o vinil para stands',
			'Muestra digital antes de fabricar el tiraje completo',
			'Escalas de descuento progresivas según volumen'
		],
		precio_desde: 6500,
		cantidad_minima: 15,
		imagekit_path: null,
		destacado: false,
		activo: true,
		orden: 4,
		updated_at: '2026-11-04T00:00:00Z'
	}
];

export const DEFAULT_OUTBOUND_TEMPLATES = [
	{
		clave: 'b2b_prospeccion_frio',
		nombre: 'B2B · Prospección en frío',
		cuerpo: `¡Hola{{contacto}}! Te escribo de Taller Creativo.

Revisamos el perfil de *{{empresa}}* y preparamos una propuesta con opciones de uniformes, termos con grabado láser y kits corporativos personalizados con su marca, con simulador de precios por volumen:

{{link_empresas}}

{{nota_extra}}¿Tienen contemplado próximamente algún evento, renovación de uniformes o regalos corporativos para su equipo? Con gusto les preparamos una muestra digital previa sin costo para visualizar su logotipo.`
	},
	{
		clave: 'b2b_prospeccion_seguimiento',
		nombre: 'B2B · Seguimiento a empresa',
		cuerpo: `¡Hola{{contacto}}! Espero que te encuentres muy bien.

Dando seguimiento a nuestro contacto, ¿tuvieron oportunidad de revisar las opciones personalizadas para *{{empresa}}*?

{{link_empresas}}

Si nos compartes su logotipo por este medio, con gusto te preparamos una muestra digital previa sin compromiso para que puedan evaluarla. ¿Qué te parece?`
	}
] as const;

export type VolumeSimulation = {
	cantidad: number;
	precioNormalUnitario: number;
	precioUnitario: number;
	subtotalNormal: number;
	totalEstimado: number;
	ahorroPorPieza: number;
	ahorroTotal: number;
	porcentajeAhorro: number;
	escalaActiva: B2bVolumeBracket | null;
	siguienteEscala: B2bVolumeBracket | null;
	piezasParaSiguienteEscala: number;
};

/**
 * Price Anchoring & Goal-Gradient simulator:
 * computes the active wholesale bracket, savings vs. retail anchor price,
 * and the exact pieces needed to unlock the next discount tier.
 */
export function simulateVolumePricing(
	line: B2bSimulatorLine,
	rawQuantity: number
): VolumeSimulation {
	const cantidad = Math.max(1, Math.min(5000, Math.trunc(Number(rawQuantity) || 1)));
	const sorted = [...line.escalas].sort((a, b) => a.min - b.min);

	let escalaActiva: B2bVolumeBracket | null = null;
	let siguienteEscala: B2bVolumeBracket | null = null;

	for (const bracket of sorted) {
		if (cantidad >= bracket.min) {
			escalaActiva = bracket;
		} else if (!siguienteEscala) {
			siguienteEscala = bracket;
		}
	}

	const precioNormalUnitario = line.precio_normal;
	const precioUnitario = escalaActiva ? escalaActiva.precio_unitario : precioNormalUnitario;
	const subtotalNormal = precioNormalUnitario * cantidad;
	const totalEstimado = precioUnitario * cantidad;
	const ahorroPorPieza = Math.max(0, precioNormalUnitario - precioUnitario);
	const ahorroTotal = Math.max(0, subtotalNormal - totalEstimado);
	const porcentajeAhorro =
		subtotalNormal > 0 ? Math.round((ahorroTotal / subtotalNormal) * 100) : 0;
	const piezasParaSiguienteEscala = siguienteEscala
		? Math.max(0, siguienteEscala.min - cantidad)
		: 0;

	return {
		cantidad,
		precioNormalUnitario,
		precioUnitario,
		subtotalNormal,
		totalEstimado,
		ahorroPorPieza,
		ahorroTotal,
		porcentajeAhorro,
		escalaActiva,
		siguienteEscala,
		piezasParaSiguienteEscala
	};
}

/**
 * Cocktail Party Effect sanitizer: cleans a company or contact name from query params
 * (`?para=Cafetería+Central`), rejecting URLs or script-like characters.
 */
export function sanitizeProspectName(
	raw: string | null | undefined,
	maxLength = 60
): string | null {
	if (!raw) return null;
	const cleaned = cleanText(raw, false)
		.replace(/https?:\/\/\S+/gi, '')
		.replace(/[<>{}[\]\\^`|~]/g, '')
		.trim();
	if (!cleaned) return null;
	return cleaned.slice(0, maxLength);
}

export function buildProspectingLink(
	origin: string,
	params: { slug?: string; empresa?: string; contacto?: string; pack?: string }
): string {
	const base = origin.replace(/\/+$/, '');
	const slug = params.slug?.trim();
	if (slug && isSlug(slug)) {
		const search = new URLSearchParams();
		search.set('p', slug);
		return `${base}/empresas?${search.toString()}`;
	}

	const search = new URLSearchParams();
	const empresa = sanitizeProspectName(params.empresa, 60);
	const contacto = sanitizeProspectName(params.contacto, 40);
	const pack = params.pack?.trim();

	if (empresa) search.set('para', empresa);
	if (contacto) search.set('contacto', contacto);
	if (pack && isSlug(pack)) search.set('pack', pack);

	const qs = search.toString();
	return qs ? `${base}/empresas?${qs}` : `${base}/empresas`;
}

export function buildProspectingMessage(
	template: string,
	input: {
		empresa: string;
		contacto?: string;
		linkEmpresas: string;
		notaExtra?: string;
	}
): string {
	const empresa = sanitizeProspectName(input.empresa, 60) ?? 'tu empresa';
	const contactoClean = sanitizeProspectName(input.contacto, 40);
	const contactoToken = contactoClean ? `, ${contactoClean}` : '';
	const notaClean = cleanText(input.notaExtra ?? '', true);
	const notaToken = notaClean ? `${notaClean}\n\n` : '';

	return template
		.replaceAll('{{empresa}}', empresa)
		.replaceAll('{{contacto}}', contactoToken)
		.replaceAll('{{link_empresas}}', input.linkEmpresas)
		.replaceAll('{{nota_extra}}', notaToken)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export type LeadTimeClassification = {
	days: number | null;
	tier: 'flexible' | 'urgente' | 'proximo' | 'planeado';
	label: string;
};

function localDate(now: Date): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
}

/** Classifies event deadline urgency to reassure or guide the B2B buyer. */
export function classifyLeadTime(
	fechaDeseada: string | null | undefined,
	now = new Date()
): LeadTimeClassification {
	if (!fechaDeseada || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDeseada)) {
		return {
			days: null,
			tier: 'flexible',
			label: 'Producción estándar (3 a 6 días hábiles tras aprobar mockup)'
		};
	}
	const todayIso = localDate(now);
	const start = Date.parse(`${todayIso}T00:00:00Z`);
	const target = Date.parse(`${fechaDeseada}T00:00:00Z`);
	if (Number.isNaN(target) || target < start) {
		return {
			days: null,
			tier: 'flexible',
			label: 'Elige una fecha de hoy en adelante'
		};
	}
	const days = Math.round((target - start) / (1000 * 60 * 60 * 24));
	if (days <= 5) {
		return {
			days,
			tier: 'urgente',
			label: `Entrega prioritaria (${days === 0 ? 'hoy' : `en ${days} días`}): revisaremos disponibilidad inmediata en taller`
		};
	}
	if (days <= 12) {
		return {
			days,
			tier: 'proximo',
			label: `Tiempo ideal (${days} días): margen cómodo para mockup y producción`
		};
	}
	return {
		days,
		tier: 'planeado',
		label: `Planeación anticipada (${days} días): excelente para programar tu lote y asegurar fecha`
	};
}

export type B2bQuoteData = {
	empresa: string;
	correo: string | null;
	solucion: string;
	request: CustomRequestInput;
	contact: Contact;
};

function fieldText(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

const emailSchema = z.string().email().max(120);

/** Validates the public `/empresas` quote builder and formats it for `create_custom_order`. */
export function b2bQuoteFromForm(form: FormData, now = new Date()): FormResult<B2bQuoteData> {
	const empresa = cleanText(fieldText(form, 'empresa'), false);
	if (!empresa || empresa.length < 2) {
		return { ok: false, message: 'Escribe el nombre de tu empresa, marca o proyecto.' };
	}
	if (empresa.length > 100) {
		return { ok: false, message: 'El nombre de la empresa es muy largo (máximo 100 caracteres).' };
	}

	const correoRaw = cleanText(fieldText(form, 'correo'), false);
	let correo: string | null = null;
	if (correoRaw) {
		const parsedEmail = emailSchema.safeParse(correoRaw);
		if (!parsedEmail.success) {
			return { ok: false, message: 'Escribe un correo electrónico válido o déjalo en blanco.' };
		}
		correo = parsedEmail.data;
	}

	const solucion = cleanText(fieldText(form, 'solucion'), false);
	if (!solucion || solucion.length > 120) {
		return { ok: false, message: 'Selecciona el paquete o solución que te interesa cotizar.' };
	}

	const cantidad = Number(fieldText(form, 'cantidad') || '10');
	if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 5000) {
		return { ok: false, message: 'La cantidad debe ser un número entre 1 y 5,000 piezas.' };
	}

	const fecha = fieldText(form, 'fecha_deseada');
	if (fecha) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
			return { ok: false, message: 'Revisa la fecha de tu evento o entrega.' };
		}
		if (fecha < localDate(now)) {
			return { ok: false, message: 'La fecha deseada debe ser de hoy en adelante.' };
		}
	}

	const detalles = cleanText(fieldText(form, 'descripcion'), true);
	if (!detalles) {
		return {
			ok: false,
			message: 'Cuéntanos brevemente qué necesitas (colores, tallas aproximadas o idea de tu logo).'
		};
	}
	if (detalles.length > 800) {
		return { ok: false, message: 'La descripción es muy larga (máximo 800 caracteres).' };
	}

	const metodoEntrega = fieldText(form, 'metodoEntrega');
	const contact = parseContact({
		nombre: fieldText(form, 'nombre'),
		whatsapp: fieldText(form, 'whatsapp'),
		metodoEntrega,
		notas: `Empresa: ${empresa}${correo ? ` · Correo: ${correo}` : ''}`,
		direccion:
			metodoEntrega === 'recoger'
				? undefined
				: {
						calle: fieldText(form, 'calle'),
						colonia: fieldText(form, 'colonia'),
						cp: fieldText(form, 'cp'),
						ciudad: fieldText(form, 'ciudad'),
						estado: fieldText(form, 'estado'),
						referencias: fieldText(form, 'referencias_domicilio')
					}
	});
	if (!contact.ok) {
		return contact.message === 'Revisa tus datos de contacto y entrega.'
			? { ok: false, message: 'Elige cómo prefieres recibir tu pedido empresarial.' }
			: contact;
	}

	const structuredDescription = [
		`[COTIZACIÓN EMPRESARIAL — ${empresa}]`,
		`Solución / Paquete: ${solucion}`,
		correo ? `Correo: ${correo}` : null,
		`Detalles: ${detalles}`
	]
		.filter(Boolean)
		.join('\n');

	return {
		ok: true,
		value: {
			empresa,
			correo,
			solucion,
			request: {
				custom_request_type_id: null,
				descripcion: structuredDescription,
				cantidad,
				fecha_deseada: fecha || null
			},
			contact: contact.value
		}
	};
}

export type B2bPackageInput = {
	slug: string;
	nombre: string;
	subtitulo: string;
	descripcion: string;
	incluye: string[];
	precio_desde: number;
	cantidad_minima: number;
	destacado: boolean;
	activo: boolean;
	orden: number;
};

export function b2bPackageFromForm(form: FormData): FormResult<B2bPackageInput> {
	const nombre = cleanText(fieldText(form, 'nombre'), false);
	if (!nombre || nombre.length > 80) {
		return {
			ok: false,
			message: 'Escribe el nombre del paquete corporativo (máx. 80 caracteres).'
		};
	}

	const rawSlug = fieldText(form, 'slug');
	const slug = rawSlug ? slugify(rawSlug) : slugify(nombre);
	if (!slug || !isSlug(slug) || slug.length > 80) {
		return { ok: false, message: 'El identificador (slug) del paquete no es válido.' };
	}

	const subtitulo = cleanText(fieldText(form, 'subtitulo'), false);
	if (subtitulo.length > 140) {
		return { ok: false, message: 'El subtítulo es muy largo (máx. 140 caracteres).' };
	}

	const descripcion = cleanText(fieldText(form, 'descripcion'), true);
	if (!descripcion || descripcion.length > 500) {
		return { ok: false, message: 'Escribe una descripción para el paquete (máx. 500 caracteres).' };
	}

	const incluyeRaw = fieldText(form, 'incluye');
	const incluye = incluyeRaw
		.split(/\r?\n/)
		.map((line) => cleanText(line, false))
		.filter(Boolean);
	if (incluye.length === 0 || incluye.length > 8) {
		return {
			ok: false,
			message: 'Escribe entre 1 y 8 puntos en «Qué incluye» (uno por línea).'
		};
	}

	const precio = parseMoney(fieldText(form, 'precio_desde'));
	if (precio === null || Number.isNaN(precio) || precio <= 0) {
		return { ok: false, message: 'Escribe el precio «desde» en pesos (ej. 150).' };
	}

	const cantidadMinima = Number(fieldText(form, 'cantidad_minima') || '10');
	if (!Number.isInteger(cantidadMinima) || cantidadMinima < 1 || cantidadMinima > 1000) {
		return { ok: false, message: 'El mínimo de piezas debe ser entre 1 y 1,000.' };
	}

	const orden = Number(fieldText(form, 'orden') || '0');
	if (!Number.isInteger(orden) || orden < 0 || orden > 999) {
		return { ok: false, message: 'El orden debe ser un número entero de 0 a 999.' };
	}

	return {
		ok: true,
		value: {
			slug,
			nombre,
			subtitulo,
			descripcion,
			incluye,
			precio_desde: precio,
			cantidad_minima: cantidadMinima,
			destacado: form.get('destacado') === 'on',
			activo: form.get('activo') === 'on',
			orden
		}
	};
}

export type B2bProspectInput = {
	slug: string;
	empresa: string;
	contacto: string | null;
	whatsapp: string | null;
	paquete_slug: string | null;
	nota: string | null;
	logo_fondo_sugerido: B2bLogoSurface;
	activo: boolean;
};

export function b2bProspectFromForm(form: FormData): FormResult<B2bProspectInput> {
	const empresa = sanitizeProspectName(fieldText(form, 'empresa'), 80);
	if (!empresa || empresa.length < 2) {
		return {
			ok: false,
			message: 'Escribe el nombre de la empresa o marca (entre 2 y 80 caracteres).'
		};
	}

	const rawSlug = fieldText(form, 'slug');
	const slug = rawSlug ? slugify(rawSlug) : slugify(empresa);
	if (!slug || !isSlug(slug) || slug.length > 80) {
		return {
			ok: false,
			message: 'No pudimos generar un identificador (slug) válido para esta empresa.'
		};
	}

	const contacto = sanitizeProspectName(fieldText(form, 'contacto'), 60);

	const rawPhone = fieldText(form, 'whatsapp');
	let whatsapp: string | null = null;
	if (rawPhone) {
		const normalized = normalizeMxPhone(rawPhone);
		if (!normalized) {
			return {
				ok: false,
				message: 'El WhatsApp debe tener 10 dígitos válidos en México (o déjalo en blanco).'
			};
		}
		whatsapp = normalized;
	}

	const rawPack = fieldText(form, 'paquete_slug');
	let paquete_slug: string | null = null;
	if (rawPack) {
		if (!isSlug(rawPack) || rawPack.length > 80) {
			return { ok: false, message: 'El paquete recomendado seleccionado no es válido.' };
		}
		paquete_slug = rawPack;
	}

	const rawNota = cleanText(fieldText(form, 'nota'), true);
	if (rawNota.length > 280) {
		return {
			ok: false,
			message: 'La nota personalizada es muy larga (máximo 280 caracteres).'
		};
	}
	const nota = rawNota || null;

	const rawFondo = fieldText(form, 'logo_fondo_sugerido');
	const logo_fondo_sugerido: B2bLogoSurface = rawFondo === 'light' ? 'light' : 'dark';

	const activoRaw = form.get('activo');
	const activo = activoRaw === null ? true : activoRaw === 'on' || activoRaw === 'true';

	return {
		ok: true,
		value: {
			slug,
			empresa,
			contacto,
			whatsapp,
			paquete_slug,
			nota,
			logo_fondo_sugerido,
			activo
		}
	};
}

export function parseB2bSettingsRow(
	row: Partial<{
		badge_texto: string;
		hero_titulo: string;
		hero_subtitulo: string;
		stat_piezas_entregadas: string;
		stat_tiempo_respuesta: string;
		stat_minimo_piezas: string;
		garantias: unknown;
		escalas_simulador: unknown;
		faqs: unknown;
	}> | null
): B2bSettings {
	if (!row) return DEFAULT_B2B_SETTINGS;

	const garantias =
		Array.isArray(row.garantias) && row.garantias.length > 0
			? (row.garantias as B2bGuarantee[])
			: DEFAULT_B2B_SETTINGS.garantias;

	const escalas =
		Array.isArray(row.escalas_simulador) && row.escalas_simulador.length > 0
			? (row.escalas_simulador as B2bSimulatorLine[])
			: DEFAULT_B2B_SETTINGS.escalas_simulador;

	const faqs =
		Array.isArray(row.faqs) && row.faqs.length > 0
			? (row.faqs as B2bFaq[])
			: DEFAULT_B2B_SETTINGS.faqs;

	return {
		badge_texto: row.badge_texto || DEFAULT_B2B_SETTINGS.badge_texto,
		hero_titulo: row.hero_titulo || DEFAULT_B2B_SETTINGS.hero_titulo,
		hero_subtitulo: row.hero_subtitulo || DEFAULT_B2B_SETTINGS.hero_subtitulo,
		stat_piezas_entregadas:
			row.stat_piezas_entregadas || DEFAULT_B2B_SETTINGS.stat_piezas_entregadas,
		stat_tiempo_respuesta: row.stat_tiempo_respuesta || DEFAULT_B2B_SETTINGS.stat_tiempo_respuesta,
		stat_minimo_piezas: row.stat_minimo_piezas || DEFAULT_B2B_SETTINGS.stat_minimo_piezas,
		garantias,
		escalas_simulador: escalas,
		faqs
	};
}

export function b2bSettingsFromForm(
	form: FormData,
	current: B2bSettings = DEFAULT_B2B_SETTINGS
): FormResult<B2bSettings> {
	const badge_texto = cleanText(fieldText(form, 'badge_texto'), false);
	const hero_titulo = cleanText(fieldText(form, 'hero_titulo'), false);
	const hero_subtitulo = cleanText(fieldText(form, 'hero_subtitulo'), true);
	const stat_piezas_entregadas = cleanText(fieldText(form, 'stat_piezas_entregadas'), false);
	const stat_tiempo_respuesta = cleanText(fieldText(form, 'stat_tiempo_respuesta'), false);
	const stat_minimo_piezas = cleanText(fieldText(form, 'stat_minimo_piezas'), false);

	if (!hero_titulo || hero_titulo.length > 140) {
		return { ok: false, message: 'Escribe el título principal de la vista (máx. 140 caracteres).' };
	}
	if (!hero_subtitulo || hero_subtitulo.length > 320) {
		return { ok: false, message: 'Escribe el subtítulo del hero (máx. 320 caracteres).' };
	}

	const garantias: B2bGuarantee[] = [];
	for (let i = 0; i < 3; i++) {
		const titulo = cleanText(fieldText(form, `garantia_titulo_${i}`), false);
		const descripcion = cleanText(fieldText(form, `garantia_desc_${i}`), true);
		if (titulo && descripcion) {
			garantias.push({ titulo: titulo.slice(0, 90), descripcion: descripcion.slice(0, 260) });
		}
	}

	const faqsRaw = fieldText(form, 'faqs_text');
	const faqs: B2bFaq[] = [];
	if (faqsRaw) {
		const blocks = faqsRaw
			.split(/\r?\n\s*\r?\n/)
			.map((b) => b.trim())
			.filter(Boolean);
		for (const block of blocks) {
			const [firstLine, ...rest] = block.split(/\r?\n/);
			const pregunta = cleanText(firstLine ?? '', false);
			const respuesta = cleanText(rest.join(' '), true);
			if (pregunta && respuesta) {
				faqs.push({ pregunta: pregunta.slice(0, 140), respuesta: respuesta.slice(0, 400) });
			}
		}
	}

	return {
		ok: true,
		value: {
			badge_texto: badge_texto || current.badge_texto,
			hero_titulo,
			hero_subtitulo,
			stat_piezas_entregadas: stat_piezas_entregadas || current.stat_piezas_entregadas,
			stat_tiempo_respuesta: stat_tiempo_respuesta || current.stat_tiempo_respuesta,
			stat_minimo_piezas: stat_minimo_piezas || current.stat_minimo_piezas,
			garantias: garantias.length > 0 ? garantias : current.garantias,
			escalas_simulador: current.escalas_simulador,
			faqs: faqs.length > 0 ? faqs : current.faqs
		}
	};
}
