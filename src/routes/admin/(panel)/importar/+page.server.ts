import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { TemplateSample } from '#lib/domain/import-template.js';
import {
	normalizeFileName,
	planImport,
	planImportRow,
	rowsFromJson
} from '#lib/domain/product-import.js';
import { importDeps, importPlannedRow, loadImportCatalog } from '#lib/server/product-import.js';
import type { Actions, PageServerLoad } from './$types';

const uuid = z.uuid();

/** Most files a single row can reference: two design versions plus the photos. */
const MAX_FILES_PER_ROW = 10;

export const load: PageServerLoad = async ({ locals }) => {
	const [categories, types, bases, collections] = await Promise.all([
		locals.supabase.from('categories').select('slug, nombre').order('orden').order('nombre'),
		locals.supabase.from('garment_types').select('id, nombre, tallas').order('nombre'),
		locals.supabase
			.from('garment_bases')
			.select('garment_type_id, color_nombre')
			.order('color_nombre'),
		locals.supabase.from('collections').select('slug, nombre').order('nombre')
	]);
	if (categories.error || types.error || bases.error || collections.error) {
		error(500, 'No pudimos cargar los datos del catálogo.');
	}

	// The template uses real values so it imports without edits.
	const garment = types.data.find(
		(type) => type.tallas.length && bases.data.some((base) => base.garment_type_id === type.id)
	);
	const sample: TemplateSample = {
		categoria: categories.data[0]?.slug ?? null,
		coleccion: collections.data[0]?.slug ?? null,
		prenda: garment
			? {
					nombre: garment.nombre,
					colores: bases.data
						.filter((base) => base.garment_type_id === garment.id)
						.slice(0, 2)
						.map((base) => base.color_nombre),
					talla: garment.tallas[0]
				}
			: null
	};

	return {
		sample,
		reference: {
			categorias: categories.data,
			colecciones: collections.data,
			prendas: types.data.map((type) => ({
				nombre: type.nombre,
				tallas: type.tallas,
				colores: bases.data
					.filter((base) => base.garment_type_id === type.id)
					.map((base) => base.color_nombre)
			}))
		}
	};
};

export const actions = {
	/** Dry run: validates every row against the catalog; writes nothing. */
	validar: async ({ request, locals }) => {
		const form = await request.formData();
		const rows = rowsFromJson(form.get('rows'));
		if (!rows) return fail(400, { message: 'No pudimos leer las filas del CSV.' });

		let names: unknown;
		try {
			names = JSON.parse(String(form.get('files') ?? '[]'));
		} catch {
			names = null;
		}
		if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
			return fail(400, { message: 'No pudimos leer la lista de imágenes.' });
		}

		const catalog = await loadImportCatalog(
			locals.supabase,
			rows.map((item) => item.row)
		);
		if (!catalog) return fail(500, { message: 'No pudimos cargar los datos del catálogo.' });

		const report = planImport(rows, catalog, new Set(names as string[]));
		return {
			report: report.map((item) =>
				item.ok
					? { line: item.line, nombre: item.nombre, slug: item.slug, ok: true as const }
					: {
							line: item.line,
							nombre: item.nombre,
							slug: item.slug,
							ok: false as const,
							message: item.message
						}
			)
		};
	},

	/** Imports one row with its images; the browser sends rows one by one. */
	importar_fila: async ({ request, locals }) => {
		const form = await request.formData();
		const rows = rowsFromJson(form.get('row'));
		if (!rows || rows.length !== 1) return fail(400, { message: 'No pudimos leer la fila.' });
		const [{ row }] = rows;

		const uploads = form.getAll('archivo').filter((value): value is File => value instanceof File);
		if (uploads.length > MAX_FILES_PER_ROW) {
			return fail(400, { message: 'La fila trae demasiadas imágenes.' });
		}
		const files = new Map(uploads.map((file) => [normalizeFileName(file.name), file]));

		// When an earlier row in the same import batch already uploaded and created the design,
		// the browser sends its id so this row links to it instead of duplicating it.
		const rawReusedId = String(form.get('reused_design_id') ?? '').trim();
		let reusedDesignId: string | null = null;
		if (rawReusedId) {
			if (!uuid.safeParse(rawReusedId).success) {
				return fail(400, { message: 'El diseño compartido no es válido.' });
			}
			const { data: existingDesign } = await locals.supabase
				.from('designs')
				.select('id')
				.eq('id', rawReusedId)
				.maybeSingle();
			if (!existingDesign) {
				return fail(400, { message: 'El diseño compartido ya no existe.' });
			}
			reusedDesignId = existingDesign.id;
		}

		const catalog = await loadImportCatalog(locals.supabase, [row]);
		if (!catalog) return fail(500, { message: 'No pudimos cargar los datos del catálogo.' });

		const knownFiles = new Set(files.keys());
		if (reusedDesignId) {
			if (row.diseno_oscura?.trim()) knownFiles.add(normalizeFileName(row.diseno_oscura));
			if (row.diseno_clara?.trim()) knownFiles.add(normalizeFileName(row.diseno_clara));
		}

		// Planned again on the server: the browser's dry run is never trusted.
		const plan = planImportRow(row, catalog, knownFiles);
		if (!plan.ok) return fail(400, { message: plan.message });

		const result = await importPlannedRow(
			plan.value,
			files,
			importDeps(locals.supabase),
			reusedDesignId
		);
		if (!result.ok) return fail(400, { message: result.message });
		return { id: result.id, designId: result.designId };
	}
} satisfies Actions;
