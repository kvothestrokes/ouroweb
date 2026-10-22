<script lang="ts">
	import { resolve } from '$app/paths';
	import CatalogFilters from '#lib/components/store/CatalogFilters.svelte';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.collection.nombre} — Colecciones — Ouroboros</title>
	<meta
		name="description"
		content="Playeras, sudaderas y regalos de {data.collection
			.nombre}. Pide por WhatsApp en Ouroboros."
	/>
</svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
	<header class="flex flex-col gap-1">
		<a
			href={resolve('/(store)/colecciones')}
			class="w-fit text-sm text-muted-foreground hover:text-foreground"
		>
			Colecciones
		</a>
		<h1 class="text-3xl md:text-4xl">{data.collection.nombre}</h1>
	</header>

	{#if data.total}
		<CatalogFilters
			filters={data.filters}
			facets={data.facets}
			collections={data.collections}
			total={data.products.length}
			hideCollection
		>
			<ProductGrid products={data.products} preferredColors={data.filters.colores}>
				{#snippet empty()}
					<EmptyState title="Nada con esos filtros">Prueba quitando alguno.</EmptyState>
				{/snippet}
			</ProductGrid>
		</CatalogFilters>
	{:else}
		<EmptyState title="Muy pronto">Estamos preparando los diseños de esta colección.</EmptyState>
	{/if}
</div>
