// Shared test data for the store domain (not imported by app code).
import type { StoreProductRow } from './store-product.js';

export const playera = {
	nombre: 'Playera',
	tallas: ['CH', 'M', 'G', 'XG', 'XXG'],
	recargos_talla: { XG: 2000, XXG: 3000 },
	guia_tallas: { M: { ancho_cm: 51, largo_cm: 71 } },
	precio_normal: 17000,
	precio_mayoreo: 15000,
	mayoreo_cantidad_min: 6
};

export function row(overrides: Partial<StoreProductRow> = {}): StoreProductRow {
	return {
		id: 'p1',
		slug: 'akatsuki',
		nombre: 'Playera Akatsuki',
		descripcion: 'Nubes rojas',
		category_id: 'c1',
		tipo_imagen: 'mockup',
		precio_base: null,
		precio_oferta: null,
		oferta_hasta: null,
		modo_stock: 'bajo_pedido',
		permite_personalizar: true,
		destacado: false,
		created_at: '2026-10-01T00:00:00Z',
		updated_at: '2026-10-02T00:00:00Z',
		garment_types: playera,
		product_colors: [
			{
				garment_bases: {
					id: 'b-negro',
					color_nombre: 'Negro',
					color_hex: '#111111',
					foto: 'playera/negro'
				}
			},
			{
				garment_bases: {
					id: 'b-rojo',
					color_nombre: 'Rojo',
					color_hex: '#cc0000',
					foto: 'playera/rojo'
				}
			}
		],
		product_images: [],
		product_stock: [],
		product_collections: [{ collections: { slug: 'naruto', nombre: 'Naruto' } }],
		...overrides
	};
}
