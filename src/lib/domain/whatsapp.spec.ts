import { describe, expect, it } from 'vitest';
import { renderTemplate, summaryLine, whatsappLink } from './whatsapp.js';

describe('whatsappLink', () => {
	it('builds a wa.me link with the encoded message', () => {
		expect(whatsappLink('529612423984', 'Hola, ¿tienen talla XG? #1 & más')).toBe(
			'https://wa.me/529612423984?text=Hola%2C%20%C2%BFtienen%20talla%20XG%3F%20%231%20%26%20m%C3%A1s'
		);
	});

	it('leaves out the text when there is no message', () => {
		expect(whatsappLink('529612423984')).toBe('https://wa.me/529612423984');
	});
});

describe('renderTemplate', () => {
	it('never reads inherited keys like constructor', () => {
		expect(renderTemplate('{{constructor}}{{__proto__}}', {})).toBe('');
	});

	it('replaces variables and blanks the unknown ones', () => {
		expect(
			renderTemplate('Pedido *{{folio}}* de {{nombre}} {{guia}}!', {
				folio: 'OUR-2610-0001',
				nombre: 'Ana'
			})
		).toBe('Pedido *OUR-2610-0001* de Ana !');
	});
});

describe('summaryLine', () => {
	it('formats quantity, name, color, size and amount', () => {
		expect(
			summaryLine({
				cantidad: 2,
				nombre: 'Playera Akatsuki',
				color: 'Negro',
				talla: 'M',
				importe: 56000,
				personalizacion: null
			})
		).toBe('• 2× Playera Akatsuki · Negro · M — $560.00');
	});

	it('adds the customization on its own line', () => {
		expect(
			summaryLine({
				cantidad: 1,
				nombre: 'Taza',
				color: null,
				talla: null,
				importe: 18000,
				personalizacion: 'Ana'
			})
		).toBe('• 1× Taza — $180.00\n  ✏️ Personalización: Ana (por cotizar)');
	});
});
