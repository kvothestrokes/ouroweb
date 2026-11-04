import { describe, expect, it } from 'vitest';
import {
	DEFAULT_B2B_SETTINGS,
	DEFAULT_OUTBOUND_TEMPLATES,
	b2bPackageFromForm,
	b2bProspectFromForm,
	b2bQuoteFromForm,
	b2bSettingsFromForm,
	buildProspectingLink,
	buildProspectingMessage,
	classifyLeadTime,
	sanitizeProspectName,
	simulateVolumePricing
} from './b2b.js';

describe('simulateVolumePricing', () => {
	const line = DEFAULT_B2B_SETTINGS.escalas_simulador[0]; // Playeras ($170 normal, 10+: $150, 25+: $140, 50+: $130, 100+: $120)

	it('returns retail anchor price below minimum tier and calculates pieces to next bracket', () => {
		const res = simulateVolumePricing(line, 6);
		expect(res.cantidad).toBe(6);
		expect(res.precioUnitario).toBe(17000);
		expect(res.ahorroTotal).toBe(0);
		expect(res.escalaActiva).toBeNull();
		expect(res.siguienteEscala?.min).toBe(10);
		expect(res.piezasParaSiguienteEscala).toBe(4);
	});

	it('applies exact bracket at 25 pieces and calculates total savings', () => {
		const res = simulateVolumePricing(line, 25);
		expect(res.precioUnitario).toBe(14000);
		expect(res.ahorroPorPieza).toBe(3000);
		expect(res.ahorroTotal).toBe(75000); // $750 MXN saved
		expect(res.escalaActiva?.min).toBe(25);
		expect(res.siguienteEscala?.min).toBe(50);
		expect(res.piezasParaSiguienteEscala).toBe(25);
	});

	it('applies top bracket at 100+ pieces with no next tier', () => {
		const res = simulateVolumePricing(line, 120);
		expect(res.precioUnitario).toBe(12000);
		expect(res.ahorroTotal).toBe(5000 * 120);
		expect(res.siguienteEscala).toBeNull();
		expect(res.piezasParaSiguienteEscala).toBe(0);
	});
});

describe('prospecting personalization (Cocktail Party Effect)', () => {
	it('sanitizes prospect names by stripping URLs and brackets', () => {
		expect(sanitizeProspectName('  Cafetería Central <script> https://evil.com ')).toBe(
			'Cafetería Central script'
		);
		expect(sanitizeProspectName('')).toBeNull();
	});

	it('builds clean prospecting URLs with encoded parameters or short slug', () => {
		const url = buildProspectingLink('https://ouroboros.mx/', {
			empresa: 'Gym Titán',
			contacto: 'Sofía',
			pack: 'uniformes-equipo'
		});
		expect(url).toBe(
			'https://ouroboros.mx/empresas?para=Gym+Tit%C3%A1n&contacto=Sof%C3%ADa&pack=uniformes-equipo'
		);

		const slugUrl = buildProspectingLink('https://ouroboros.mx/', {
			slug: 'cafeteria-central',
			empresa: 'Cafetería Central'
		});
		expect(slugUrl).toBe('https://ouroboros.mx/empresas?p=cafeteria-central');
	});

	it('validates and normalizes a saved B2B prospect form', () => {
		const form = new FormData();
		form.set('empresa', 'Clínica Dental Roble');
		form.set('contacto', 'Dra. Elena');
		form.set('whatsapp', '961 234 5678');
		form.set('paquete_slug', 'uniformes-equipo');
		form.set('nota', 'Propuesta de uniformes y termos para su equipo.');
		form.set('logo_fondo_sugerido', 'light');

		const res = b2bProspectFromForm(form);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.slug).toBe('clinica-dental-roble');
		expect(res.value.whatsapp).toBe('529612345678');
		expect(res.value.logo_fondo_sugerido).toBe('light');
		expect(res.value.activo).toBe(true);
	});

	it('renders outbound WhatsApp message with optional contact and note', () => {
		const msg = buildProspectingMessage(DEFAULT_OUTBOUND_TEMPLATES[0].cuerpo, {
			empresa: 'Cafetería Central',
			contacto: 'Carlos',
			linkEmpresas: 'https://ouroboros.mx/empresas?para=Cafeteria+Central',
			notaExtra: 'Nos encantó su nueva sucursal en el centro.'
		});
		expect(msg).toContain('¡Hola, Carlos!');
		expect(msg).toContain('*Cafetería Central*');
		expect(msg).toContain('https://ouroboros.mx/empresas?para=Cafeteria+Central');
		expect(msg).toContain('Nos encantó su nueva sucursal en el centro.');
	});
});

describe('classifyLeadTime', () => {
	const now = new Date('2026-11-04T12:00:00Z');

	it('marks dates within 5 days as urgent priority', () => {
		const res = classifyLeadTime('2026-11-07', now);
		expect(res.tier).toBe('urgente');
		expect(res.days).toBe(3);
	});

	it('marks dates 6 to 12 days out as ideal', () => {
		const res = classifyLeadTime('2026-11-12', now);
		expect(res.tier).toBe('proximo');
		expect(res.days).toBe(8);
	});

	it('marks dates beyond 12 days as planned', () => {
		const res = classifyLeadTime('2026-11-25', now);
		expect(res.tier).toBe('planeado');
		expect(res.days).toBe(21);
	});
});

describe('b2bQuoteFromForm', () => {
	const now = new Date('2026-11-04T12:00:00Z');

	function baseForm(overrides: Record<string, string> = {}): FormData {
		const form = new FormData();
		const data: Record<string, string> = {
			empresa: 'Restaurante El Mirador',
			nombre: 'Laura Méndez',
			whatsapp: '9611234567',
			correo: 'compras@elmirador.mx',
			solucion: 'Pack Uniformes y Staff',
			cantidad: '30',
			fecha_deseada: '2026-11-20',
			metodoEntrega: 'recoger',
			descripcion: '30 playeras negras con logo en pecho izquierdo y frase en espalda.',
			...overrides
		};
		for (const [k, v] of Object.entries(data)) form.set(k, v);
		return form;
	}

	it('parses a valid B2B quote into a structured CustomRequestInput and Contact', () => {
		const result = b2bQuoteFromForm(baseForm(), now);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.empresa).toBe('Restaurante El Mirador');
		expect(result.value.request.cantidad).toBe(30);
		expect(result.value.request.descripcion).toContain(
			'[COTIZACIÓN EMPRESARIAL — Restaurante El Mirador]'
		);
		expect(result.value.request.descripcion).toContain('Pack Uniformes y Staff');
		expect(result.value.contact.whatsapp).toBe('529611234567');
	});

	it('rejects missing company name or invalid email', () => {
		expect(b2bQuoteFromForm(baseForm({ empresa: '' }), now)).toEqual({
			ok: false,
			message: 'Escribe el nombre de tu empresa, marca o proyecto.'
		});
		expect(b2bQuoteFromForm(baseForm({ correo: 'no-es-correo' }), now)).toEqual({
			ok: false,
			message: 'Escribe un correo electrónico válido o déjalo en blanco.'
		});
	});
});

describe('b2bPackageFromForm & b2bSettingsFromForm', () => {
	it('parses a corporate package form and generates slug automatically', () => {
		const form = new FormData();
		form.set('nombre', 'Kit Fin de Año');
		form.set('subtitulo', 'Regalo ejecutivo para clientes');
		form.set('descripcion', 'Incluye termo grabado y vela aromática.');
		form.set('incluye', 'Termo acero inoxidable\nVela de soya\nCaja personalizada');
		form.set('precio_desde', '350');
		form.set('cantidad_minima', '12');
		form.set('orden', '2');
		form.set('destacado', 'on');
		form.set('activo', 'on');

		const res = b2bPackageFromForm(form);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.slug).toBe('kit-fin-de-ano');
		expect(res.value.precio_desde).toBe(35000);
		expect(res.value.incluye).toHaveLength(3);
	});

	it('parses B2B landing settings and FAQ blocks', () => {
		const form = new FormData();
		form.set('badge_texto', 'Ouroboros Empresas');
		form.set('hero_titulo', 'Uniformes y regalos corporativos.');
		form.set('hero_subtitulo', 'Hechos en Chiapas para todo México.');
		form.set('stat_piezas_entregadas', '+2,000 piezas');
		form.set('stat_tiempo_respuesta', 'Menos de 2 h');
		form.set('stat_minimo_piezas', 'Desde 10 piezas');
		form.set('faqs_text', '¿Facturan?\nSí, contáctanos por WhatsApp.\n\n¿Envían?\nA todo el país.');

		const res = b2bSettingsFromForm(form);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.faqs).toHaveLength(2);
		expect(res.value.faqs[0].pregunta).toBe('¿Facturan?');
	});
});
