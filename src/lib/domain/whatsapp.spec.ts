import { describe, expect, it } from 'vitest';
import { whatsappLink } from './whatsapp.js';

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
