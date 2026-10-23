<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { LoaderCircle, Plus } from '@lucide/svelte';
	import DesignFileInput from '#lib/components/admin/DesignFileInput.svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let uploading = $state(false);
</script>

<svelte:head>
	<title>Diseños · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Diseños</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Los PNG transparentes que se estampan en las prendas. Se guardan en una carpeta privada: en la
	tienda solo se ven ya puestos sobre la prenda y con marca de agua.
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<details class="mt-6 rounded-xl border border-border bg-card" open={data.designs.length === 0}>
	<summary
		class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 font-medium text-foreground"
	>
		<Plus size={18} strokeWidth={1.75} aria-hidden="true" />
		Nuevo diseño
	</summary>
	<form
		method="POST"
		action="?/crear"
		enctype="multipart/form-data"
		class="flex flex-col gap-4 border-t border-border p-5"
		use:enhance={() => {
			uploading = true;
			return async ({ update }) => {
				await update();
				uploading = false;
			};
		}}
	>
		<div class="flex max-w-md flex-col gap-2">
			<Label for="nombre">Nombre</Label>
			<Input id="nombre" name="nombre" required maxlength={80} class="min-h-11" />
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<DesignFileInput
				name="oscura"
				label="Versión para prendas oscuras"
				hint="PNG transparente. Es la versión principal."
			/>
			<DesignFileInput
				name="clara"
				label="Versión para prendas claras (opcional)"
				hint="Por ejemplo, con tinta oscura. Si no la subes, se usa la otra."
			/>
		</div>
		<div>
			<Button type="submit" class="min-h-11" disabled={uploading}>
				{#if uploading}
					<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
					Subiendo…
				{:else}
					Subir diseño
				{/if}
			</Button>
		</div>
	</form>
</details>

{#if data.designs.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay diseños. Sube el primero con el formulario de arriba.
	</p>
{:else}
	<ul class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
		{#each data.designs as design (design.id)}
			<li>
				<a
					href={resolve('/admin/(panel)/disenos/[id]', { id: design.id })}
					class="block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-surface-raised"
				>
					<div class="aspect-square bg-surface-raised">
						{#if data.thumbnailBaseId}
							<img
								src="{resolve('/admin/(panel)/disenos/[id]/mockup/[baseId]', {
									id: design.id,
									baseId: data.thumbnailBaseId
								})}?s=400"
								alt="Diseño {design.nombre} sobre una prenda"
								width="400"
								height="400"
								loading="lazy"
								draggable="false"
								class="size-full object-cover"
							/>
						{/if}
					</div>
					<div class="p-3">
						<p class="truncate text-sm font-medium text-foreground">{design.nombre}</p>
						<p class="text-xs text-muted-foreground">
							{design.path_prenda_clara && design.path_prenda_oscura
								? 'Versión oscura y clara'
								: 'Una versión'}
						</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<section
	class="mt-12 max-w-3xl rounded-xl border border-border bg-card/50 p-5"
	aria-labelledby="mantenimiento"
>
	<h2 id="mantenimiento" class="font-display text-lg text-foreground">Archivos sin usar</h2>
	<p class="mt-1 text-sm text-muted-foreground">
		Diseños y fotos de producto que quedaron guardados en ImageKit pero ya ningún producto ni diseño
		usa. Solo se consideran los que tienen más de 10 minutos.
	</p>
	{#if form?.orphans}
		{#if form.orphans.length === 0}
			<p class="mt-3 text-sm text-success">No hay archivos sin usar.</p>
		{:else}
			<p class="mt-3 text-sm text-foreground">
				Hay {form.orphans.length}
				{form.orphans.length === 1 ? 'archivo' : 'archivos'} sin usar:
			</p>
			<ul class="mt-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
				{#each form.orphans as path (path)}
					<li class="truncate">{path}</li>
				{/each}
			</ul>
			<form
				method="POST"
				action="?/borrar_huerfanos"
				class="mt-3"
				use:enhance={({ cancel }) => {
					if (!confirm('¿Borrar estos archivos de ImageKit? No se puede deshacer.')) cancel();
				}}
			>
				<button
					type="submit"
					class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
				>
					Borrar archivos sin usar
				</button>
			</form>
		{/if}
	{:else}
		<form method="POST" action="?/revisar_huerfanos" class="mt-3" use:enhance>
			<Button type="submit" variant="outline" class="min-h-11">Revisar</Button>
		</form>
	{/if}
</section>
