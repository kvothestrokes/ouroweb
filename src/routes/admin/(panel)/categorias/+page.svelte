<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Eye, EyeOff, Pencil, Plus, Star } from '@lucide/svelte';
	import CategoryFields from '#lib/components/admin/CategoryFields.svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { CategoryRow } from '#lib/domain/catalog.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let creating = $state(false);

	const roots = $derived(data.tree.map(({ id, nombre }) => ({ id, nombre })));
</script>

<svelte:head>
	<title>Categorías · Panel Ouroboros</title>
</svelte:head>

{#snippet actions(category: CategoryRow, isChild: boolean)}
	<div class="flex shrink-0 items-center gap-1">
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

{#snippet label(category: CategoryRow)}
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
	Las categorías principales van en el menú de la tienda; la subcategoría con estrella sale en el
	banner de su categoría.
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
				<div class="flex items-center gap-3 px-4 py-2">
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
