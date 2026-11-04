import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
import {
	DEFAULT_B2B_PACKAGES,
	DEFAULT_OUTBOUND_TEMPLATES,
	parseB2bSettingsRow,
	type B2bPackage,
	type B2bPortfolioItem,
	type B2bQuoteData,
	type B2bSettings
} from '#lib/domain/b2b.js';
import { deliveryLabel } from '#lib/domain/checkout.js';
import { MAX_REFERENCE_IMAGES } from '#lib/domain/custom-request.js';
import { renderTemplate, whatsappLink } from '#lib/domain/whatsapp.js';
import type { CustomOrderResult } from './custom-orders.js';
import { uploadImage } from './imagekit.js';
import { prepareReference } from './reference-images.js';
import { publicDb } from './store.js';
import { supabaseAdmin } from './supabase-admin.js';

export type PublicB2bPortfolioCard = {
	id: string;
	titulo: string;
	giro_empresa: string;
	version: number;
	kind: 'b2b' | 'gallery';
};

export type PublicB2bPackageCard = B2bPackage & {
	version: number;
};

export type PublicB2bLandingData = {
	settings: B2bSettings;
	packages: PublicB2bPackageCard[];
	portfolio: PublicB2bPortfolioCard[];
};

const FALLBACK_QUOTE_TEMPLATE = `¡Hola!
Acabo de registrar una solicitud de cotización empresarial con folio *{{folio}}*

Empresa: *{{empresa}}*
Contacto: {{nombre}}
Entrega: {{metodo_entrega}}

{{resumen}}

Quedo al pendiente de la propuesta y la muestra digital. ¡Gracias!`;

const UNAVAILABLE =
	'No pudimos registrar tu solicitud en este momento. Intenta de nuevo o escríbenos directo por WhatsApp.';

function formatDate(date: string): string {
	return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`)
	);
}

/**
 * Loads B2B landing configuration, packages, and portfolio.
 * Gracefully falls back to domain defaults if the migration has not been pushed yet.
 */
export async function loadB2bPublicData(): Promise<PublicB2bLandingData> {
	const db = publicDb();
	const [settingsRes, packagesRes, portfolioRes] = await Promise.all([
		db.from('b2b_settings').select('*').eq('id', 1).maybeSingle(),
		db
			.from('b2b_packages')
			.select('*')
			.eq('activo', true)
			.order('orden', { ascending: true })
			.order('created_at', { ascending: true }),
		db
			.from('b2b_portfolio')
			.select('*')
			.eq('activo', true)
			.order('orden', { ascending: true })
			.order('created_at', { ascending: false })
			.limit(12)
	]);

	const settings = parseB2bSettingsRow(settingsRes.data);

	const rawPackages =
		!packagesRes.error && packagesRes.data && packagesRes.data.length > 0
			? packagesRes.data
			: DEFAULT_B2B_PACKAGES;

	const packages: PublicB2bPackageCard[] = rawPackages.map((item) => ({
		...item,
		version: Date.parse(item.updated_at) || 1
	}));

	let portfolio: PublicB2bPortfolioCard[] = [];
	if (!portfolioRes.error && portfolioRes.data && portfolioRes.data.length > 0) {
		portfolio = portfolioRes.data.map((item) => ({
			id: item.id,
			titulo: item.titulo,
			giro_empresa: item.giro_empresa || 'Pedido empresarial',
			version: Date.parse(item.updated_at) || 1,
			kind: 'b2b'
		}));
	} else {
		// If no dedicated B2B portfolio items have been uploaded yet, show recent gallery work.
		const { data: gallery } = await db
			.from('gallery_items')
			.select('id, titulo, updated_at, collections(nombre)')
			.order('orden', { ascending: true })
			.order('created_at', { ascending: false })
			.limit(6);
		if (gallery?.length) {
			portfolio = gallery.map((item) => ({
				id: item.id,
				titulo: item.titulo || 'Trabajo personalizado en taller',
				giro_empresa: item.collections?.nombre ?? 'Muestra de taller',
				version: Date.parse(item.updated_at) || 1,
				kind: 'gallery'
			}));
		}
	}

	return { settings, packages, portfolio };
}

export type AdminB2bData = {
	migrationReady: boolean;
	settings: B2bSettings;
	packages: (B2bPackage & { version: number })[];
	portfolio: (B2bPortfolioItem & { version: number })[];
	templates: { clave: string; nombre: string; cuerpo: string }[];
};

export async function loadB2bAdminData(): Promise<AdminB2bData> {
	const [settingsRes, packagesRes, portfolioRes, templatesRes] = await Promise.all([
		supabaseAdmin.from('b2b_settings').select('*').eq('id', 1).maybeSingle(),
		supabaseAdmin
			.from('b2b_packages')
			.select('*')
			.order('orden', { ascending: true })
			.order('created_at', { ascending: true }),
		supabaseAdmin
			.from('b2b_portfolio')
			.select('*')
			.order('orden', { ascending: true })
			.order('created_at', { ascending: false }),
		supabaseAdmin
			.from('wa_templates')
			.select('clave, nombre, cuerpo')
			.in('clave', ['b2b_prospeccion_frio', 'b2b_prospeccion_seguimiento', 'b2b_cotizacion_nueva'])
			.order('clave', { ascending: true })
	]);

	const migrationReady = !settingsRes.error && !packagesRes.error && !portfolioRes.error;
	const settings = parseB2bSettingsRow(settingsRes.data);
	const rawPackages =
		!packagesRes.error && packagesRes.data ? packagesRes.data : DEFAULT_B2B_PACKAGES;

	const packages = rawPackages.map((item) => ({
		...item,
		version: Date.parse(item.updated_at) || 1
	}));

	const portfolio = (!portfolioRes.error && portfolioRes.data ? portfolioRes.data : []).map(
		(item) => ({
			...item,
			version: Date.parse(item.updated_at) || 1
		})
	);

	const templates =
		templatesRes.data && templatesRes.data.length > 0
			? templatesRes.data
			: [...DEFAULT_OUTBOUND_TEMPLATES];

	return {
		migrationReady,
		settings,
		packages,
		portfolio,
		templates
	};
}

/**
 * Registers a B2B quote request as a tracked custom order (`OUR-YYMM-NNNN`),
 * uploads logo/reference files to `/ouroboros/orders/<folio>`, and builds the WhatsApp link.
 */
export async function placeB2bQuoteOrder(
	quote: B2bQuoteData,
	files: File[]
): Promise<CustomOrderResult> {
	if (files.length > MAX_REFERENCE_IMAGES) {
		return {
			ok: false,
			status: 400,
			message: `Puedes adjuntar hasta ${MAX_REFERENCE_IMAGES} archivos de logotipo o referencia.`
		};
	}

	const images: Buffer[] = [];
	for (const file of files) {
		const prepared = await prepareReference(file);
		if (!prepared.ok) return { ok: false, status: 400, message: prepared.message };
		images.push(prepared.bytes);
	}

	const { data: folio, error } = await supabaseAdmin.rpc('create_custom_order', {
		p_order: {
			cliente_nombre: `${quote.contact.nombre} (${quote.empresa})`.slice(0, 80),
			cliente_whatsapp: quote.contact.whatsapp,
			metodo_entrega: quote.contact.metodoEntrega,
			direccion: quote.contact.direccion,
			notas_cliente: quote.contact.notas
		},
		p_request: quote.request
	});

	if (error || !folio) {
		if (error?.message === 'too_many_orders' || error?.message === 'store_busy') {
			return {
				ok: false,
				status: 429,
				message:
					'Recibimos varias solicitudes seguidas. Escríbenos directo por WhatsApp para atender a tu empresa de inmediato.'
			};
		}
		return { ok: false, status: 503, message: UNAVAILABLE };
	}

	const paths: string[] = [];
	for (const [i, bytes] of images.entries()) {
		try {
			paths.push(
				await uploadImage(
					new File([new Uint8Array(bytes)], `logo-b2b-${i + 1}.webp`, { type: 'image/webp' }),
					'orders',
					folio
				)
			);
		} catch {
			// Reported below through `referencias`.
		}
	}

	if (paths.length) {
		const { data: order } = await supabaseAdmin
			.from('orders')
			.select('id')
			.eq('folio', folio)
			.single();
		if (order) {
			await supabaseAdmin
				.from('custom_requests')
				.update({ archivos_referencia: paths })
				.eq('order_id', order.id);
		}
	}

	const { data: template } = await supabaseAdmin
		.from('wa_templates')
		.select('cuerpo')
		.eq('clave', 'b2b_cotizacion_nueva')
		.maybeSingle();

	const resumen = [
		`Solución: ${quote.solucion}`,
		`Cantidad estimada: ${quote.request.cantidad} piezas`,
		quote.request.fecha_deseada
			? `Fecha requerida: ${formatDate(quote.request.fecha_deseada)}`
			: null,
		quote.correo ? `Correo: ${quote.correo}` : null,
		`\nDescripción:\n${quote.request.descripcion}`,
		paths.length
			? `\nArchivos adjuntos: ${paths.length === 1 ? 'Se adjuntó 1 archivo de logotipo/referencia.' : `Se adjuntaron ${paths.length} archivos de logotipo/referencia.`}`
			: null
	]
		.filter(Boolean)
		.join('\n');

	const message = renderTemplate(template?.cuerpo ?? FALLBACK_QUOTE_TEMPLATE, {
		folio,
		empresa: quote.empresa,
		nombre: quote.contact.nombre,
		metodo_entrega: deliveryLabel(quote.contact.metodoEntrega),
		resumen
	});

	return {
		ok: true,
		order: {
			folio,
			whatsappUrl: whatsappLink(PUBLIC_WHATSAPP_NUMBER, message),
			referencias: paths.length
		}
	};
}
