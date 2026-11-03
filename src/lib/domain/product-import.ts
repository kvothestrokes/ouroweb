import { z } from 'zod';
import { parseCsv } from './csv.js';
import type { FormResult } from './catalog.js';
import { productFromForm, type ProductContext, type ProductInput } from './product.js';
import { slugify } from './slug.js';

/** Columns of `productos.csv`, in the order of the downloadable template. */
export const IMPORT_COLUMNS = [
	'nombre',
	'slug',
	'categoria',
	'tipo_imagen',
	'tipo_prenda',
	'diseno_nombre',
	'diseno_oscura',
	'diseno_clara',
	'diseno_existente',
	'colores',
	'fotos',
	'descripcion',
	'precio',
	'precio_oferta',
	'oferta_hasta',
	'modo_stock',
	'stock',
	'colecciones',
	'permite_personalizar',
	'destacado',
	'activo'
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Partial<Record<ImportColumn, string>>;
export type NumberedRow = { line: number; row: ImportRow };

const REQUIRED_COLUMNS: ImportColumn[] = ['nombre', 'categoria', 'tipo_imagen'];
export const MAX_IMPORT_ROWS = 500;
export const MAX_PHOTOS_PER_ROW = 8;

/**
 * Placeholder design id used while validating a row whose design is uploaded in the same
 * import; the real id replaces it once the design row exists.
 */
export const PENDING_DESIGN_ID = '00000000-0000-4000-8000-000000000000';

/** Catalog data the import resolves human keys (slugs, names) against. */
export type ImportCatalog = {
	categories: { id: string; slug: string }[];
	garmentTypes: { id: string; nombre: string; tallas: string[]; precio_normal: number | null }[];
	bases: { id: string; garment_type_id: string; color_nombre: string }[];
	collections: { id: string; slug: string }[];
	designs: { id: string; nombre: string }[];
	/** Product slugs already taken (only the ones the file asks for need to be here). */
	existingSlugs: string[];
};

export type ImportPlan = {
	input: ProductInput;
	/** Design uploaded with this row (file names inside the package), or null. */
	newDesign: { nombre: string; oscura: string | null; clara: string | null } | null;
	/** Photo file names, in display order. */
	fotos: string[];
};

export type ImportReportItem = { line: number; nombre: string; slug: string } & (
	{ ok: true; plan: ImportPlan } | { ok: false; message: string }
);

/** `Diseño Oscura ` → `diseno_oscura`. */
function normalizeHeader(header: string): string {
	return header
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_');
}

function isColumn(name: string): name is ImportColumn {
	return (IMPORT_COLUMNS as readonly string[]).includes(name);
}

/** Reads `productos.csv` into rows keyed by column, with their spreadsheet line number. */
export function parseImportTable(text: string): FormResult<NumberedRow[]> {
	let table: string[][];
	try {
		table = parseCsv(text);
	} catch {
		return { ok: false, message: 'El CSV está mal formado: revisa que las comillas cierren.' };
	}
	const [header, ...body] = table;
	if (!header) return { ok: false, message: 'El CSV está vacío.' };

	const columns = header.map(normalizeHeader);
	const unknown = columns.filter((column) => !isColumn(column));
	if (unknown.length) {
		return { ok: false, message: `Columnas desconocidas: ${unknown.join(', ')}.` };
	}
	const repeated = columns.filter((column, index) => columns.indexOf(column) !== index);
	if (repeated.length) {
		return { ok: false, message: `Columnas repetidas: ${[...new Set(repeated)].join(', ')}.` };
	}
	const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
	if (missing.length) {
		return { ok: false, message: `Faltan columnas obligatorias: ${missing.join(', ')}.` };
	}

	const rows: NumberedRow[] = [];
	body.forEach((cells, index) => {
		if (cells.every((cell) => cell.trim() === '')) return;
		const row: ImportRow = {};
		columns.forEach((column, i) => {
			row[column as ImportColumn] = (cells[i] ?? '').trim();
		});
		rows.push({ line: index + 2, row });
	});
	if (rows.length === 0) return { ok: false, message: 'El CSV no tiene productos.' };
	if (rows.length > MAX_IMPORT_ROWS) {
		return {
			ok: false,
			message: `El CSV tiene ${rows.length} productos; el máximo por carga es ${MAX_IMPORT_ROWS}.`
		};
	}
	return { ok: true, value: rows };
}

function list(value: string | undefined): string[] {
	return (value ?? '')
		.split('|')
		.map((item) => item.trim())
		.filter(Boolean);
}

const TRUE = new Set(['si', 's', 'true', '1', 'x', 'yes']);
const FALSE = new Set(['no', 'n', 'false', '0']);

/** `sí` / `no` columns; empty means no. Anything else is an error, never a silent default. */
function flag(row: ImportRow, column: ImportColumn): FormResult<boolean> {
	const value = slugify(row[column] ?? '');
	if (value === '' || FALSE.has(value)) return { ok: true, value: false };
	if (TRUE.has(value)) return { ok: true, value: true };
	return { ok: false, message: `${column} debe ser «si» o «no».` };
}

function fail(message: string): { ok: false; message: string } {
	return { ok: false, message };
}

/** The slug a row will get: its own, or the one derived from the name. */
export function rowSlug(row: ImportRow): string {
	return row.slug?.trim() || slugify(row.nombre ?? '');
}

/**
 * Strips any folder prefix (`imagenes/a.png` or `imagenes\a.png`), normalizes Unicode to NFC
 * (macOS Finder writes NFD, Excel writes NFC) and lowercases so file matching is case-insensitive.
 */
export function normalizeFileName(path: string): string {
	const trimmed = path.trim();
	const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
	return trimmed
		.slice(slash + 1)
		.trim()
		.normalize('NFC')
		.toLowerCase();
}

/**
 * Canonical key for a row's new design (`diseno_nombre::oscura::clara`). Two rows in the same
 * CSV with the same key share one uploaded design instead of creating duplicates in DB + ImageKit.
 */
export function designKey(row: ImportRow): string | null {
	if ((row.tipo_imagen ?? '').toLowerCase() !== 'mockup' || row.diseno_existente?.trim()) {
		return null;
	}
	const oscura = row.diseno_oscura?.trim() ? normalizeFileName(row.diseno_oscura) : '';
	const clara = row.diseno_clara?.trim() ? normalizeFileName(row.diseno_clara) : '';
	if (!oscura && !clara) return null;
	const explicitName = (row.diseno_nombre ?? '').trim().normalize('NFC').toLowerCase();
	return `${explicitName}::${oscura}::${clara}`;
}

/**
 * Turns one CSV row into the same input the manual product form produces: human keys are
 * resolved to ids and the result goes through `productFromForm`, so both paths share every rule.
 * `files` holds the image file names present in the uploaded package.
 */
export function planImportRow(
	row: ImportRow,
	catalog: ImportCatalog,
	files: ReadonlySet<string>
): FormResult<ImportPlan> {
	const form = new FormData();
	const set = (name: string, value: string | undefined) => form.set(name, value ?? '');
	set('nombre', row.nombre);
	set('slug', row.slug);
	set('descripcion', row.descripcion);
	set('precio', row.precio);
	set('precio_oferta', row.precio_oferta);
	set('oferta_hasta', row.oferta_hasta);

	const categoria = row.categoria ?? '';
	const category = catalog.categories.find((item) => item.slug === categoria);
	if (!category) return fail(`No existe la categoría «${categoria}» (usa su slug).`);
	set('category_id', category.id);

	const tipo = (row.tipo_imagen ?? '').toLowerCase();
	if (tipo !== 'mockup' && tipo !== 'foto') return fail('tipo_imagen debe ser «mockup» o «foto».');
	set('tipo_imagen', tipo);

	const tipoPrenda = row.tipo_prenda ?? '';
	const garmentType = tipoPrenda
		? catalog.garmentTypes.find((type) => slugify(type.nombre) === slugify(tipoPrenda))
		: undefined;
	if (tipoPrenda && !garmentType) return fail(`No existe el tipo de prenda «${tipoPrenda}».`);
	if (garmentType) set('garment_type_id', garmentType.id);

	// Colors, by name within the garment type.
	const colorNames = list(row.colores);
	if (colorNames.length && !garmentType) {
		return fail('colores solo aplica cuando el producto tiene tipo_prenda.');
	}
	const baseByColor = new Map<string, string>();
	for (const name of colorNames) {
		const base = catalog.bases.find(
			(item) =>
				item.garment_type_id === garmentType?.id && slugify(item.color_nombre) === slugify(name)
		);
		if (!base) return fail(`El color «${name}» no existe para ${garmentType?.nombre}.`);
		form.append('colores', base.id);
		baseByColor.set(slugify(name), base.id);
	}

	// Images: a design (new files or an existing one) for mockups, photos for photo products.
	const availableFiles = new Set([...files].map(normalizeFileName));
	const oscura = row.diseno_oscura?.trim() ? normalizeFileName(row.diseno_oscura) : null;
	const clara = row.diseno_clara?.trim() ? normalizeFileName(row.diseno_clara) : null;
	const existente = row.diseno_existente?.trim() || null;
	const fotos = list(row.fotos).map(normalizeFileName);
	let newDesign: ImportPlan['newDesign'] = null;
	if (tipo === 'mockup') {
		if (fotos.length) return fail('La columna fotos solo aplica a productos tipo foto.');
		if (existente && (oscura || clara)) {
			return fail('Usa diseno_existente o los archivos del diseño, no ambos.');
		}
		if (existente) {
			const matches = catalog.designs.filter((design) => design.nombre === existente);
			if (matches.length === 0) {
				return fail(`No existe un diseño llamado «${existente}» (el nombre debe ser exacto).`);
			}
			if (matches.length > 1) return fail(`Hay varios diseños llamados «${existente}».`);
			set('design_id', matches[0].id);
		} else if (oscura || clara) {
			for (const name of [oscura, clara]) {
				if (!name) continue;
				if (!/\.png$/i.test(name)) return fail(`El diseño «${name}» debe ser un PNG.`);
				if (!availableFiles.has(name)) return fail(`Falta el archivo «${name}» en el paquete.`);
			}
			newDesign = {
				nombre: row.diseno_nombre?.trim() || (row.nombre ?? '').trim(),
				oscura,
				clara
			};
			set('design_id', PENDING_DESIGN_ID);
		} else {
			return fail('Falta el diseño: llena diseno_oscura, diseno_clara o diseno_existente.');
		}
	} else {
		if (oscura || clara || existente || row.diseno_nombre?.trim()) {
			return fail('Los productos tipo foto no llevan diseño; quita las columnas del diseño.');
		}
		if (fotos.length === 0) {
			return fail('Los productos tipo foto necesitan al menos una foto en la columna fotos.');
		}
		if (fotos.length > MAX_PHOTOS_PER_ROW) {
			return fail(`Máximo ${MAX_PHOTOS_PER_ROW} fotos por producto.`);
		}
		for (const name of fotos) {
			if (!availableFiles.has(name)) return fail(`Falta el archivo «${name}» en el paquete.`);
		}
	}

	// Stock: `color:talla=cantidad;...`, sizes not listed count as 0.
	const modo = (row.modo_stock ?? '').toLowerCase() || 'bajo_pedido';
	if (modo !== 'stock' && modo !== 'bajo_pedido') {
		return fail('modo_stock debe ser «stock» o «bajo_pedido».');
	}
	set('modo_stock', modo);
	const stockText = row.stock?.trim() ?? '';
	if (stockText && modo !== 'stock') return fail('Para cargar stock pon modo_stock = stock.');
	const seen = new Set<string>();
	for (const entry of stockText
		.split(';')
		.map((item) => item.trim())
		.filter(Boolean)) {
		const match = /^(.+?)\s*:\s*([^:=]+?)\s*=\s*(\d{1,4})$/.exec(entry);
		if (!match) {
			return fail('Revisa la columna stock: usa color:talla=cantidad separados por «;».');
		}
		const [, color, tallaText, cantidad] = match;
		const baseId = baseByColor.get(slugify(color));
		if (!baseId) return fail(`El color «${color}» de stock no está en colores.`);
		const talla = garmentType?.tallas.find(
			(item) => item.toLowerCase() === tallaText.toLowerCase()
		);
		if (!talla) {
			return fail(
				`La talla «${tallaText}» no existe para ${garmentType?.nombre} (${garmentType?.tallas.join(', ')}).`
			);
		}
		const key = `${baseId}.${talla}`;
		if (seen.has(key)) return fail(`La combinación «${color}:${talla}» se repite en stock.`);
		seen.add(key);
		set(`stock.${key}`, cantidad);
	}

	const collections = list(row.colecciones);
	for (const slug of collections) {
		const collection = catalog.collections.find((item) => item.slug === slug);
		if (!collection) return fail(`No existe la colección «${slug}» (usa su slug).`);
		form.append('colecciones', collection.id);
	}

	for (const column of ['permite_personalizar', 'destacado', 'activo'] as const) {
		const value = flag(row, column);
		if (!value.ok) return value;
		if (value.value) set(column, 'on');
	}

	const context: ProductContext = { garmentTypes: catalog.garmentTypes, bases: catalog.bases };
	const input = productFromForm(form, context);
	if (!input.ok) return input;
	if (catalog.existingSlugs.includes(input.value.product.slug)) {
		return fail(`Ya existe un producto con el slug «${input.value.product.slug}».`);
	}
	return { ok: true, value: { input: input.value, newDesign, fotos } };
}

/** Plans every row; a slug repeated inside the file is an error from its second use on. */
export function planImport(
	rows: NumberedRow[],
	catalog: ImportCatalog,
	files: ReadonlySet<string>
): ImportReportItem[] {
	const lineBySlug = new Map<string, number>();
	return rows.map(({ line, row }) => {
		const nombre = (row.nombre ?? '').trim();
		const result = planImportRow(row, catalog, files);
		const slug = result.ok ? result.value.input.product.slug : rowSlug(row);
		const firstLine = lineBySlug.get(slug);
		if (slug && firstLine === undefined) lineBySlug.set(slug, line);
		if (firstLine !== undefined) {
			return {
				line,
				nombre,
				slug,
				ok: false,
				message: `El slug «${slug}» se repite: ya lo usa la línea ${firstLine}.`
			};
		}
		return result.ok
			? { line, nombre, slug, ok: true, plan: result.value }
			: { line, nombre, slug, ok: false, message: result.message };
	});
}

const numberedRowSchema = z.strictObject({
	line: z.int().min(2).max(100_000),
	row: z.partialRecord(z.enum(IMPORT_COLUMNS), z.string().max(4000))
});

/** Rows posted back by the browser (JSON); null when the payload is not a valid row list. */
export function rowsFromJson(text: unknown): NumberedRow[] | null {
	if (typeof text !== 'string' || text.length > 2_000_000) return null;
	try {
		const parsed = z
			.array(numberedRowSchema)
			.min(1)
			.max(MAX_IMPORT_ROWS)
			.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
