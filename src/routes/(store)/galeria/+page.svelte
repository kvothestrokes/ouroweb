<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ReviewList from '#lib/components/store/ReviewList.svelte';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let filter = $state<string | null>(null);
	const visible = $derived(
		filter ? data.items.filter((item) => item.coleccion === filter) : data.items
	);
	const chip =
		'inline-flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors';
</script>

<Seo
	title="Galería de trabajos — Ouroboros"
	description="Trabajos que hemos hecho para nuestros clientes y lo que opinan de ellos."
	image={data.items[0]?.src ?? null}
/>

<div class="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 md:px-6 md:py-10">
	<header>
		<h1 class="text-3xl md:text-4xl">Galería de trabajos</h1>
		<p class="mt-2 text-muted-foreground">Algunas piezas que ya están con sus dueños.</p>
	</header>

	{#if data.items.length}
		{#if data.collections.length}
			<div
				class="flex [scrollbar-width:none] gap-2 overflow-x-auto"
				role="group"
				aria-label="Filtrar por colección"
			>
				<button
					type="button"
					aria-pressed={filter === null}
					onclick={() => (filter = null)}
					class={cn(
						chip,
						filter === null
							? 'border-transparent bg-accent text-accent-foreground'
							: 'border-border text-muted-foreground'
					)}
				>
					Todo
				</button>
				{#each data.collections as collection (collection.id)}
					<button
						type="button"
						aria-pressed={filter === collection.slug}
						onclick={() => (filter = collection.slug)}
						class={cn(
							chip,
							filter === collection.slug
								? 'border-transparent bg-accent text-accent-foreground'
								: 'border-border text-muted-foreground'
						)}
					>
						{collection.nombre}
					</button>
				{/each}
			</div>
		{/if}
		<ul class="columns-2 gap-4 sm:columns-3 lg:columns-4">
			{#each visible as item (item.id)}
				<li class="mb-4 break-inside-avoid">
					<figure class="overflow-hidden rounded-xl border border-border bg-surface">
						<img
							src={item.src}
							alt={item.titulo || 'Trabajo de Ouroboros'}
							loading="lazy"
							draggable="false"
							class="w-full image-guard"
						/>
						{#if item.titulo}<figcaption class="p-3 text-sm">{item.titulo}</figcaption>{/if}
					</figure>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState title="Muy pronto">
			Estamos juntando fotos de nuestros trabajos.
			{#snippet action()}
				<a
					href={resolve('/(store)/encargos')}
					class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
				>
					Pide tu encargo
				</a>
			{/snippet}
		</EmptyState>
	{/if}

	{#if data.reviews.length}
		<section aria-labelledby="opiniones">
			<h2 id="opiniones" class="mb-6 text-2xl">Opiniones</h2>
			<ReviewList reviews={data.reviews} />
		</section>
	{/if}
</div>
