import { IMPORT_COLUMNS, type ImportColumn, type ImportRow } from './product-import.js';

/** Real catalog values the template examples use, so the template imports as is. */
export type TemplateSample = {
	categoria: string | null;
	coleccion: string | null;
	prenda: { nombre: string; colores: string[]; talla: string } | null;
};

export const TEMPLATE_DESIGN = 'ejemplo-diseno.png';
export const TEMPLATE_PHOTO = 'ejemplo-foto.jpg';

export type FieldRequirement = 'obligatorio' | 'mockup' | 'foto' | 'opcional';

export type ImportFieldDoc = {
	column: ImportColumn;
	requirement: FieldRequirement;
	description: string;
	example: string;
};

/** Reference for every CSV column, rendered in the admin guide and verified against IMPORT_COLUMNS. */
export const IMPORT_FIELD_DOCS: ImportFieldDoc[] = [
	{
		column: 'nombre',
		requirement: 'obligatorio',
		description: 'Nombre visible del producto en la tienda (máx. 80 caracteres).',
		example: 'Playera Calavera'
	},
	{
		column: 'slug',
		requirement: 'opcional',
		description: 'Identificador en la URL. Si lo dejas vacío se genera solo desde el nombre.',
		example: 'playera-calavera'
	},
	{
		column: 'categoria',
		requirement: 'obligatorio',
		description: 'Slug exacto de la categoría donde se mostrará.',
		example: 'playeras-anime'
	},
	{
		column: 'tipo_imagen',
		requirement: 'obligatorio',
		description:
			'Cómo se muestra el producto: «mockup» (diseño sobre prenda) o «foto» (fotos reales).',
		example: 'mockup'
	},
	{
		column: 'tipo_prenda',
		requirement: 'mockup',
		description: 'Nombre del tipo de prenda para armar el mockup y heredar tallas/precios.',
		example: 'Playera'
	},
	{
		column: 'diseno_nombre',
		requirement: 'opcional',
		description:
			'Nombre para guardar el diseño nuevo en el catálogo. Si va vacío usa el nombre del producto.',
		example: 'Calavera blanca'
	},
	{
		column: 'diseno_oscura',
		requirement: 'mockup',
		description: 'Archivo PNG con fondo transparente para prendas oscuras (mín. 400 px de ancho).',
		example: 'calavera-blanca.png'
	},
	{
		column: 'diseno_clara',
		requirement: 'mockup',
		description:
			'Archivo PNG transparente para prendas claras. Puedes subir oscura, clara o ambas.',
		example: 'calavera-negra.png'
	},
	{
		column: 'diseno_existente',
		requirement: 'opcional',
		description: 'Nombre exacto de un diseño ya subido al panel, si no quieres subir un PNG nuevo.',
		example: 'Logo Ouroboros'
	},
	{
		column: 'colores',
		requirement: 'mockup',
		description: 'Colores disponibles de la prenda separados por barra vertical «|».',
		example: 'Negro|Blanco|Rojo'
	},
	{
		column: 'fotos',
		requirement: 'foto',
		description:
			'Archivos JPG, PNG o WebP separados por «|» en el orden en que aparecerán (mín. 600 px).',
		example: 'frente.jpg|detalle.jpg'
	},
	{
		column: 'descripcion',
		requirement: 'opcional',
		description: 'Texto descriptivo del producto (material, corte, cuidados).',
		example: 'Algodón 100% peinado.'
	},
	{
		column: 'precio',
		requirement: 'opcional',
		description:
			'Precio en pesos MXN. En prendas es opcional (hereda el del tipo de prenda); en otros es obligatorio.',
		example: '170'
	},
	{
		column: 'precio_oferta',
		requirement: 'opcional',
		description: 'Precio rebajado en pesos MXN (debe ser menor al precio normal).',
		example: '149.50'
	},
	{
		column: 'oferta_hasta',
		requirement: 'opcional',
		description: 'Fecha límite de la oferta en formato AAAA-MM-DD (requiere precio_oferta).',
		example: '2026-12-31'
	},
	{
		column: 'modo_stock',
		requirement: 'opcional',
		description:
			'«bajo_pedido» (predeterminado) o «stock» para llevar inventario por color y talla.',
		example: 'stock'
	},
	{
		column: 'stock',
		requirement: 'opcional',
		description:
			'Inventario por color y talla (`color:talla=cantidad` separados por «;»). Tallas omitidas quedan en 0.',
		example: 'Negro:M=5;Negro:G=3'
	},
	{
		column: 'colecciones',
		requirement: 'opcional',
		description: 'Slugs de colecciones separados por «|».',
		example: 'anime|halloween'
	},
	{
		column: 'permite_personalizar',
		requirement: 'opcional',
		description: '«si» o «no» (vacío = no). Permite al cliente pedir ajustes sobre este producto.',
		example: 'si'
	},
	{
		column: 'destacado',
		requirement: 'opcional',
		description: '«si» o «no» (vacío = no). Destaca el producto en la portada.',
		example: 'no'
	},
	{
		column: 'activo',
		requirement: 'opcional',
		description:
			'«si» o «no» (vacío = no). Si va vacío se crea como borrador oculto hasta que lo actives.',
		example: 'no'
	}
];

/** Header plus one mockup example (when there is a garment) and one photo example. */
export function templateRows(sample: TemplateSample): string[][] {
	const examples: ImportRow[] = [];
	const categoria = sample.categoria ?? 'slug-de-categoria';
	if (sample.prenda) {
		const [first, second] = sample.prenda.colores;
		examples.push({
			nombre: 'Playera de ejemplo',
			categoria,
			tipo_imagen: 'mockup',
			tipo_prenda: sample.prenda.nombre,
			diseno_nombre: 'Diseño de ejemplo',
			diseno_oscura: TEMPLATE_DESIGN,
			colores: [first, second].filter(Boolean).join('|'),
			descripcion: 'Playera de algodón con diseño de ejemplo.',
			modo_stock: 'stock',
			stock: `${first}:${sample.prenda.talla}=5`,
			colecciones: sample.coleccion ?? '',
			permite_personalizar: 'si',
			destacado: 'no',
			activo: 'no'
		});
	}
	examples.push({
		nombre: 'Producto con foto de ejemplo',
		categoria,
		tipo_imagen: 'foto',
		fotos: TEMPLATE_PHOTO,
		descripcion: 'Producto que se muestra con fotos reales.',
		precio: '250',
		modo_stock: 'bajo_pedido',
		activo: 'no'
	});
	return [
		[...IMPORT_COLUMNS],
		...examples.map((row) => IMPORT_COLUMNS.map((column: ImportColumn) => row[column] ?? ''))
	];
}

/** Plain-text guide shipped inside the template ZIP. */
export const TEMPLATE_GUIDE = `CARGA MASIVA DE PRODUCTOS
==========================

1. Edita productos.csv (Excel, Numbers o Google Sheets; guárdalo como CSV UTF-8).
2. Pon las imágenes dentro de la carpeta imagenes/ (o en cualquier carpeta del ZIP).
3. En el CSV escribe solo el nombre del archivo (ej. calavera.png), sin carpeta.
4. Comprime todo en un ZIP y súbelo en Panel > Importar productos.

Obligatorias: nombre, categoria (slug), tipo_imagen (mockup o foto).
Mockup: tipo_prenda, colores (separados por |) y diseno_oscura y/o diseno_clara
        (PNG transparente) o diseno_existente (nombre exacto de un diseño ya subido).
Foto:   fotos (archivos separados por |, en el orden en que se muestran) y precio
        si no es una prenda.
Opcionales: slug, diseno_nombre, descripcion, precio, precio_oferta,
        oferta_hasta (AAAA-MM-DD), modo_stock (stock o bajo_pedido),
        stock (color:talla=cantidad separados por ;), colecciones (slugs separados por |),
        permite_personalizar, destacado, activo (si o no).

Precios en pesos (170 o 170.50). Los productos se crean como borrador si activo está vacío.
Si un slug ya existe, la fila se marca como duplicada y no se modifica nada.
`;
