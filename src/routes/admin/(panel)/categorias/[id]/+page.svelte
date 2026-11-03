<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ImagePlus, Trash2 } from '@lucide/svelte';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import CategoryFields from '#lib/components/admin/CategoryFields.svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	let uploading = $state(false);

	const uploadCover: SubmitFunction = async ({ formData }) => {
		uploading = true;
		const photo = formData.get('foto');
		if (photo instanceof File && photo.size > 0) {
			formData.set('foto', await downscaleImage(photo, 2000, { keepPng: false }));
		}
		return async ({ update }) => {
			await update();
			uploading = false;
		};
	};
</script>

<svelte:head>
	<title>{data.category.nombre} · Categorías · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/categorias')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Categorías
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">{data.category.nombre}</h1>

<FormMessage error={form?.message} success={form?.success} class="mt-4" />

{#if !data.category.parent_id}
	<section class="mt-6 max-w-3xl rounded-xl border border-border bg-card p-5">
		<h2 class="font-display text-lg text-foreground">Imagen en el panel de inicio</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Se muestra en el mosaico de categorías de la pantalla principal.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-4">
			<div
				class="flex aspect-[16/10] w-44 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised"
			>
				{#if data.category.imagen_url}
					<img
						src={data.category.imagen_url}
						alt="Portada de {data.category.nombre}"
						class="size-full object-cover"
					/>
				{:else}
					<span class="text-xs text-muted-foreground">Sin imagen</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<form
					method="POST"
					action="?/imagen"
					enctype="multipart/form-data"
					use:enhance={uploadCover}
				>
					<label
						class={[
							'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors',
							uploading
								? 'pointer-events-none opacity-60'
								: 'text-foreground hover:bg-surface-raised'
						]}
					>
						<ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
						<span>
							{#if uploading}
								Subiendo…
							{:else if data.category.imagen_url}
								Cambiar imagen
							{:else}
								Subir imagen
							{/if}
						</span>
						<input
							type="file"
							name="foto"
							accept="image/jpeg,image/png,image/webp"
							disabled={uploading}
							onchange={(event) => event.currentTarget.form?.requestSubmit()}
							class="sr-only"
						/>
					</label>
				</form>
				{#if data.category.imagen_url}
					<form method="POST" action="?/quitarImagen" use:enhance>
						<button
							type="submit"
							class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
						>
							<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
							Quitar imagen
						</button>
					</form>
				{/if}
			</div>
		</div>
	</section>
{/if}

<form
	method="POST"
	action="?/guardar"
	class="mt-6 flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-5"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<CategoryFields roots={data.roots} values={data.category} />
	{#if data.hasChildren}
		<p class="text-xs text-muted-foreground">
			Tiene subcategorías, así que sigue siendo una categoría principal.
		</p>
	{/if}
	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{saving ? 'Guardando…' : 'Guardar cambios'}
		</Button>
	</div>
</form>

<form
	method="POST"
	action="?/eliminar"
	class="mt-6"
	use:enhance={({ cancel }) => {
		if (!confirm(`¿Eliminar la categoría «${data.category.nombre}»?`)) cancel();
	}}
>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
	>
		<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
		Eliminar categoría
	</button>
</form>
