<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, LoaderCircle, Trash2 } from '@lucide/svelte';
	import DesignFileInput from '#lib/components/admin/DesignFileInput.svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	// Changes after each save, so the previews reload with the new files.
	let version = $state(0);
</script>

<svelte:head>
	<title>{data.design.nombre} · Diseños · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/disenos')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Diseños
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">{data.design.nombre}</h1>

<FormMessage error={form?.message} success={form?.success} class="mt-4" />

<form
	method="POST"
	action="?/guardar"
	enctype="multipart/form-data"
	class="mt-6 flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-5"
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			// Reset clears the file inputs, so a later save does not upload the same file again.
			await update();
			if (result.type === 'success') version += 1;
			saving = false;
		};
	}}
>
	<div class="flex max-w-md flex-col gap-2">
		<Label for="nombre">Nombre</Label>
		<Input
			id="nombre"
			name="nombre"
			required
			maxlength={80}
			value={data.design.nombre}
			class="min-h-11"
		/>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<DesignFileInput
			name="oscura"
			label="Versión para prendas oscuras"
			hint="PNG transparente."
			current={data.design.hasOscura}
		/>
		<DesignFileInput
			name="clara"
			label="Versión para prendas claras"
			hint="Opcional. Si no hay, se usa la versión para prendas oscuras."
			current={data.design.hasClara}
		/>
	</div>
	{#if data.design.hasClara && data.design.hasOscura}
		<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
			<input type="checkbox" name="quitar_clara" class="size-5 accent-[var(--gold)]" />
			Quitar la versión para prendas claras
		</label>
	{/if}
	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{#if saving}
				<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
				Guardando…
			{:else}
				Guardar cambios
			{/if}
		</Button>
	</div>
</form>

<section class="mt-10" aria-labelledby="preview-title">
	<h2 id="preview-title" class="font-display text-xl text-foreground">
		Vista previa en todos los colores
	</h2>
	{#if data.previews.length === 0}
		<p
			class="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
		>
			Aún no hay prendas base. Regístralas en
			<a href={resolve('/admin/(panel)/prendas-base')} class="text-purple-light underline"
				>Prendas base</a
			>
			para ver el diseño en cada color.
		</p>
	{/if}
	{#each data.previews as group (group.tipo)}
		<h3 class="mt-6 text-sm font-medium text-muted-foreground">{group.tipo}</h3>
		<ul class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each group.items as base (base.id)}
				<li class="overflow-hidden rounded-xl border border-border bg-card">
					<div class="aspect-square bg-surface-raised">
						<img
							src="{resolve('/admin/(panel)/disenos/[id]/mockup/[baseId]', {
								id: data.design.id,
								baseId: base.id
							})}?s=400&v={version}"
							alt="{data.design.nombre} en {group.tipo.toLowerCase()} {base.color.toLowerCase()}"
							width="400"
							height="400"
							loading="lazy"
							draggable="false"
							class="size-full object-cover"
						/>
					</div>
					<p class="flex items-center justify-between gap-2 p-3 text-sm">
						<span class="truncate text-foreground">{base.color}</span>
						<span class="shrink-0 text-xs text-muted-foreground">
							{base.esClara ? 'Versión clara' : 'Versión oscura'}
						</span>
					</p>
				</li>
			{/each}
		</ul>
	{/each}
</section>

<form
	method="POST"
	action="?/eliminar"
	class="mt-10"
	use:enhance={({ cancel }) => {
		if (!confirm(`¿Eliminar el diseño «${data.design.nombre}»?`)) cancel();
	}}
>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
	>
		<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
		Eliminar diseño
	</button>
</form>
