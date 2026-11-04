import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { b2bPackageFromForm, b2bProspectFromForm, b2bSettingsFromForm } from '#lib/domain/b2b.js';
import { cleanText } from '#lib/domain/checkout.js';
import { loadB2bAdminData } from '#lib/server/b2b.js';
import { deleteImageByPath, signedImageUrl, uploadImage } from '#lib/server/imagekit.js';
import { prepareLogoPhoto, preparePhoto } from '#lib/server/product-photos.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const data = await loadB2bAdminData();
	return {
		origin: url.origin,
		migrationReady: data.migrationReady,
		settings: data.settings,
		templates: data.templates,
		prospects: data.prospects.map((item) => ({
			...item,
			logoSrc: item.logo_imagekit_path
				? signedImageUrl(item.logo_imagekit_path, [{ width: 320 }])
				: null
		})),
		packages: data.packages.map((pack) => ({
			...pack,
			previewSrc: pack.imagekit_path ? signedImageUrl(pack.imagekit_path, [{ width: 400 }]) : null
		})),
		portfolio: data.portfolio.map((item) => ({
			...item,
			src: signedImageUrl(item.imagekit_path, [{ width: 400 }])
		}))
	};
};

export const actions = {
	guardarConfig: async ({ request, locals }) => {
		const form = await request.formData();
		const current = (await loadB2bAdminData()).settings;
		const parsed = b2bSettingsFromForm(form, current);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		const { error } = await locals.supabase.from('b2b_settings').upsert({
			id: 1,
			...parsed.value
		});
		if (error) {
			return fail(400, {
				message:
					'No pudimos guardar la configuración B2B. Verifica que la migración de empresas esté aplicada.'
			});
		}
		return { success: 'Configuración de la vista de empresas actualizada.' };
	},

	guardarPaquete: async ({ request, locals }) => {
		const form = await request.formData();
		const idRaw = String(form.get('id') ?? '').trim();
		const isEdit = idRaw.length > 0 && z.uuid().safeParse(idRaw).success;

		const parsed = b2bPackageFromForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		let newPath: string | undefined;
		const file = form.get('foto');
		if (file instanceof File && file.size > 0) {
			const prepared = await preparePhoto(file);
			if (!prepared.ok) return fail(400, { message: prepared.message });
			try {
				newPath = await uploadImage(
					new File([new Uint8Array(prepared.bytes)], 'paquete-b2b.webp', { type: 'image/webp' }),
					'gallery',
					'b2b'
				);
			} catch {
				return fail(503, { message: 'No pudimos subir la imagen del paquete.' });
			}
		}

		if (isEdit) {
			const updatePayload = {
				...parsed.value,
				...(newPath ? { imagekit_path: newPath } : {})
			};
			const { error } = await locals.supabase
				.from('b2b_packages')
				.update(updatePayload)
				.eq('id', idRaw);
			if (error) {
				if (newPath) await deleteImageByPath(newPath);
				return fail(400, {
					message:
						error.code === '23505'
							? 'Ya existe un paquete con ese identificador (slug).'
							: 'No pudimos actualizar el paquete.'
				});
			}
			return { success: 'Paquete corporativo actualizado.' };
		}

		const { error } = await locals.supabase.from('b2b_packages').insert({
			...parsed.value,
			imagekit_path: newPath ?? null
		});
		if (error) {
			if (newPath) await deleteImageByPath(newPath);
			return fail(400, {
				message:
					error.code === '23505'
						? 'Ya existe un paquete con ese identificador (slug).'
						: 'No pudimos crear el paquete corporativo.'
			});
		}
		return { success: 'Paquete corporativo agregado.' };
	},

	eliminarPaquete: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Revisa el paquete.' });

		const { data } = await locals.supabase
			.from('b2b_packages')
			.delete()
			.eq('id', id)
			.select('imagekit_path')
			.maybeSingle();
		if (!data) return fail(400, { message: 'No pudimos eliminar el paquete.' });
		if (data.imagekit_path) await deleteImageByPath(data.imagekit_path);
		return { success: 'Paquete eliminado.' };
	},

	subirPortafolio: async ({ request, locals }) => {
		const form = await request.formData();
		const file = form.get('foto');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Elige una foto del trabajo empresarial.' });
		}
		const titulo = cleanText(String(form.get('titulo') ?? ''), false).slice(0, 120);
		if (!titulo) {
			return fail(400, { message: 'Escribe el título del caso o entrega (ej. Termos láser).' });
		}
		const giro_empresa = cleanText(String(form.get('giro_empresa') ?? ''), false).slice(0, 80);

		const prepared = await preparePhoto(file);
		if (!prepared.ok) return fail(400, { message: prepared.message });

		let path: string;
		try {
			path = await uploadImage(
				new File([new Uint8Array(prepared.bytes)], 'portafolio-b2b.webp', { type: 'image/webp' }),
				'gallery',
				'b2b'
			);
		} catch {
			return fail(503, { message: 'No pudimos subir la foto. Intenta de nuevo.' });
		}

		const { error } = await locals.supabase.from('b2b_portfolio').insert({
			titulo,
			giro_empresa: giro_empresa || 'Cliente empresarial',
			imagekit_path: path,
			activo: true,
			orden: 0
		});
		if (error) {
			await deleteImageByPath(path);
			return fail(400, { message: 'No pudimos guardar el caso en el portafolio B2B.' });
		}
		return { success: 'Caso de éxito agregado al portafolio empresarial.' };
	},

	eliminarPortafolio: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Revisa la foto.' });

		const { data } = await locals.supabase
			.from('b2b_portfolio')
			.delete()
			.eq('id', id)
			.select('imagekit_path')
			.maybeSingle();
		if (!data) return fail(400, { message: 'No pudimos eliminar la foto del portafolio.' });
		await deleteImageByPath(data.imagekit_path);
		return { success: 'Foto eliminada del portafolio B2B.' };
	},

	guardarPlantilla: async ({ request, locals }) => {
		const form = await request.formData();
		const clave = String(form.get('clave') ?? '');
		const nombre = cleanText(String(form.get('nombre') ?? ''), false).slice(0, 80);
		const cuerpo = cleanText(String(form.get('cuerpo') ?? ''), true).slice(0, 1800);

		if (
			!['b2b_prospeccion_frio', 'b2b_prospeccion_seguimiento', 'b2b_cotizacion_nueva'].includes(
				clave
			)
		) {
			return fail(400, { message: 'Plantilla no válida.' });
		}
		if (!cuerpo) return fail(400, { message: 'Escribe el mensaje de la plantilla.' });

		const { error } = await locals.supabase.from('wa_templates').upsert({
			clave,
			nombre: nombre || clave,
			cuerpo
		});
		if (error) return fail(400, { message: 'No pudimos guardar la plantilla de prospección.' });
		return { success: 'Plantilla de prospección guardada.' };
	},

	guardarProspecto: async ({ request, locals }) => {
		const form = await request.formData();
		const idRaw = String(form.get('id') ?? '').trim();
		const isEdit = idRaw.length > 0 && z.uuid().safeParse(idRaw).success;
		const removeLogo = form.get('eliminar_logo') === '1';

		const parsed = b2bProspectFromForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		let newLogoPath: string | undefined;
		const logoFile = form.get('logo');
		if (logoFile instanceof File && logoFile.size > 0) {
			const prepared = await prepareLogoPhoto(logoFile);
			if (!prepared.ok) return fail(400, { message: prepared.message });
			try {
				newLogoPath = await uploadImage(
					new File([new Uint8Array(prepared.bytes)], `logo-${parsed.value.slug}.webp`, {
						type: 'image/webp'
					}),
					'gallery',
					'b2b'
				);
			} catch {
				return fail(503, { message: 'No pudimos subir el logotipo de la empresa.' });
			}
		}

		if (isEdit) {
			const { data: prev } = await locals.supabase
				.from('b2b_prospects')
				.select('logo_imagekit_path')
				.eq('id', idRaw)
				.maybeSingle();

			const updatePayload = {
				...parsed.value,
				...(newLogoPath
					? { logo_imagekit_path: newLogoPath }
					: removeLogo
						? { logo_imagekit_path: null }
						: {})
			};

			const { error } = await locals.supabase
				.from('b2b_prospects')
				.update(updatePayload)
				.eq('id', idRaw);
			if (error) {
				if (newLogoPath) await deleteImageByPath(newLogoPath);
				return fail(400, {
					message:
						error.code === '23505'
							? 'Ya existe otra empresa registrada con ese identificador (slug).'
							: 'No pudimos actualizar los datos de la empresa.'
				});
			}

			if ((newLogoPath || removeLogo) && prev?.logo_imagekit_path) {
				await deleteImageByPath(prev.logo_imagekit_path);
			}
			return {
				success: `Enlace personalizado de ${parsed.value.empresa} actualizado.`,
				savedProspectSlug: parsed.value.slug
			};
		}

		const { error } = await locals.supabase.from('b2b_prospects').insert({
			...parsed.value,
			logo_imagekit_path: newLogoPath ?? null
		});
		if (error) {
			if (newLogoPath) await deleteImageByPath(newLogoPath);
			return fail(400, {
				message:
					error.code === '23505'
						? 'Ya existe una empresa en la lista con ese nombre o identificador. Edítala desde la lista inferior.'
						: 'No pudimos guardar la empresa. Verifica que la migración B2B esté aplicada.'
			});
		}

		return {
			success: newLogoPath
				? `Empresa ${parsed.value.empresa} guardada con su logotipo precargado.`
				: `Empresa ${parsed.value.empresa} agregada a tu lista de enlaces.`,
			savedProspectSlug: parsed.value.slug
		};
	},

	eliminarProspecto: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id') ?? '');
		if (!z.uuid().safeParse(id).success) return fail(400, { message: 'Revisa el registro.' });

		const { data } = await locals.supabase
			.from('b2b_prospects')
			.delete()
			.eq('id', id)
			.select('empresa, logo_imagekit_path')
			.maybeSingle();
		if (!data) return fail(400, { message: 'No pudimos eliminar la empresa de la lista.' });
		if (data.logo_imagekit_path) await deleteImageByPath(data.logo_imagekit_path);
		return { success: `Se eliminó ${data.empresa} de la lista.` };
	}
} satisfies Actions;
