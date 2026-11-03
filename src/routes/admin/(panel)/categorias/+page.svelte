<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Eye, EyeOff, ImagePlus, Pencil, Plus, Star, Trash2 } from '@lucide/svelte';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import CategoryFields from '#lib/components/admin/CategoryFields.svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { AdminCategoryRow } from '#lib/server/categories.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creating = $state(false);
	let uploadingId = $state<string | null>(null);

	const roots = $derived(data.tree.map(({ id, nombre }) => ({ id, nombre })));

	function uploadCover(categoryId: string): SubmitFunction {
		return async ({ formData }) => {
			uploadingId = categoryId;
			const photo = formData.get('foto');
			if (photo instanceof File && photo.size > 0) {
				formData.set('foto', await downscaleImage(photo, 2000, { keepPng: false }));
			}
			return async ({ update }) => {
				await update();
				uploadingId = null;
			};
		};
	}
</script>

<svelte:head>
	<title>Categorías · Panel Ouroboros</title>
</svelte:head>

{#snippet actions(category: AdminCategoryRow, isChild: boolean)}
	<div class="flex shrink-0 items-center gap-1">
		{#if !isChild}
			<form
				method="POST"
				action="?/imagen"
				enctype="multipart/form-data"
				use:enhance={uploadCover(category.id)}
			>
				<input type="hidden" name="id" value={category.id} />
				<label
					class={[
						'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-xs font-medium transition-colors',
						uploadingId === category.id
							? 'pointer-events-none opacity-60'
							: 'text-foreground hover:bg-surface-raised'
					]}
				>
					<ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
					<span>
						{#if uploadingId === category.id}
							Subiendo…
						{:else if category.imagen_url}
							Cambiar imagen
						{:else}
							Subir imagen
						{/if}
					</span>
					<input
						type="file"
						name="foto"
						accept="image/jpeg,image/png,image/webp"
						disabled={uploadingId === category.id}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
						class="sr-only"
					/>
				</label>
			</form>
			{#if category.imagen_url}
				<form method="POST" action="?/quitarImagen" use:enhance>
					<input type="hidden" name="id" value={category.id} />
					<button
						type="submit"
						aria-label="Quitar imagen de {category.nombre}"
						title="Quitar imagen del panel"
						class="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
					>
						<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
					</button>
				</form>
			{/if}
		{/if}
		{#if isChild}
			<form method="POST" action="?/estrella" use:enhance>
				<input type="hidden" name="id" value={category.id} />
				<button
					type="submit"
					disabled={category.es_estrella}
					aria-label={category.es_estrella
						? `${category.nombre} es la estrella`
						: `Hacer estrella a ${category.nombre}`}
					title={category.es_estrella ? 'Es la estrella' : 'Hacer estrella'}
					class={[
						'flex size-11 items-center justify-center rounded-md transition-colors',
						category.es_estrella
							? 'text-gold'
							: 'text-muted-foreground hover:bg-surface-raised hover:text-gold'
					]}
				>
					<Star
						size={18}
						strokeWidth={1.75}
						fill={category.es_estrella ? 'currentColor' : 'none'}
						aria-hidden="true"
					/>
				</button>
			</form>
		{/if}
		<form method="POST" action="?/activo" use:enhance>
			<input type="hidden" name="id" value={category.id} />
			<input type="hidden" name="activo" value={String(!category.activo)} />
			<button
				type="submit"
				aria-label={category.activo ? `Ocultar ${category.nombre}` : `Mostrar ${category.nombre}`}
				title={category.activo ? 'Ocultar en la tienda' : 'Mostrar en la tienda'}
				class="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
			>
				{#if category.activo}
					<Eye size={18} strokeWidth={1.75} aria-hidden="true" />
				{:else}
					<EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
				{/if}
			</button>
		</form>
		<a
			href={resolve('/admin/(panel)/categorias/[id]', { id: category.id })}
			aria-label="Editar {category.nombre}"
			title="Editar"
			class="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
		>
			<Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
		</a>
	</div>
{/snippet}

{#snippet label(category: AdminCategoryRow)}
	<div class="min-w-0 flex-1">
		<p
			class={[
				'truncate font-medium',
				category.activo ? 'text-foreground' : 'text-muted-foreground'
			]}
		>
			{category.nombre}
			{#if !category.activo}
				<span
					class="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground"
				>
					Oculta
				</span>
			{/if}
		</p>
		<p class="truncate text-xs text-muted-foreground">/{category.slug}</p>
	</div>
{/snippet}

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="font-display text-2xl text-foreground md:text-3xl">Categorías</h1>
</div>
<p class="mt-2 max-w-prose text-muted-foreground">
	Las categorías principales van en el menú y en los paneles de la pantalla de inicio; desde aquí
	puedes subir o cambiar la imagen de cada panel. La subcategoría con estrella sale en el banner de
	su categoría.
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<details class="mt-6 rounded-xl border border-border bg-card" open={data.tree.length === 0}>
	<summary
		class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 font-medium text-foreground"
	>
		<Plus size={18} strokeWidth={1.75} aria-hidden="true" />
		Nueva categoría
	</summary>
	<form
		method="POST"
		action="?/crear"
		class="flex flex-col gap-4 border-t border-border p-5"
		use:enhance={() => {
			creating = true;
			return async ({ update }) => {
				await update();
				creating = false;
			};
		}}
	>
		<CategoryFields {roots} idPrefix="nueva" values={{ activo: true }} />
		<div>
			<Button type="submit" class="min-h-11" disabled={creating}>
				{creating ? 'Creando…' : 'Crear categoría'}
			</Button>
		</div>
	</form>
</details>

{#if data.tree.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay categorías. Crea la primera con el formulario de arriba.
	</p>
{:else}
	<ul class="mt-6 flex flex-col gap-4">
		{#each data.tree as root (root.id)}
			<li class="rounded-xl border border-border bg-card">
				<div class="flex flex-wrap items-center gap-3 px-4 py-3">
					<div
						class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised"
					>
						{#if root.imagen_url}
							<img
								src={root.imagen_url}
								alt="Portada de {root.nombre}"
								class="size-full object-cover"
							/>
						{:else}
							<ImagePlus
								size={20}
								strokeWidth={1.75}
								class="text-muted-foreground"
								aria-hidden="true"
							/>
						{/if}
					</div>
					{@render label(root)}
					{@render actions(root, false)}
				</div>
				{#if root.children.length > 0}
					<ul class="border-t border-border">
						{#each root.children as child (child.id)}
							<li
								class="flex items-center gap-3 border-b border-border py-1 pr-4 pl-8 last:border-b-0"
							>
								{@render label(child)}
								{@render actions(child, true)}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
