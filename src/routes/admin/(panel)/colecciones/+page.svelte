<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Pencil } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creating = $state(false);
</script>

<svelte:head>
	<title>Colecciones · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Colecciones</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Fandoms que cruzan las categorías (anime, gaming, películas…). Cada una tiene su página y sirve
	como filtro en la tienda.
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<form
	method="POST"
	action="?/crear"
	class="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
	use:enhance={() => {
		creating = true;
		return async ({ update }) => {
			await update();
			creating = false;
		};
	}}
>
	<div class="flex flex-col gap-2">
		<Label for="nombre">Nombre</Label>
		<Input id="nombre" name="nombre" required maxlength={60} class="min-h-11" />
	</div>
	<div class="flex flex-col gap-2">
		<Label for="slug">Slug (URL)</Label>
		<Input id="slug" name="slug" placeholder="Se genera desde el nombre" class="min-h-11" />
	</div>
	<Button type="submit" class="min-h-11" disabled={creating}>
		{creating ? 'Creando…' : 'Crear colección'}
	</Button>
</form>

{#if data.collections.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay colecciones. Crea la primera, por ejemplo «Dragon Ball» o «Naruto».
	</p>
{:else}
	<ul class="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
		{#each data.collections as collection (collection.id)}
			<li class="flex items-center gap-3 px-4 py-1">
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium text-foreground">{collection.nombre}</p>
					<p class="truncate text-xs text-muted-foreground">/colecciones/{collection.slug}</p>
				</div>
				<a
					href={resolve('/admin/(panel)/colecciones/[id]', { id: collection.id })}
					aria-label="Editar {collection.nombre}"
					title="Editar"
					class="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
				>
					<Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
{/if}
