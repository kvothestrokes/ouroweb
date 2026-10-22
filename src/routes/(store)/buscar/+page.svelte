<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import CatalogFilters from '#lib/components/store/CatalogFilters.svelte';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title
		>{data.filters.q ? `«${data.filters.q}» — Buscar` : 'Todos los productos'} — Ouroboros</title
	>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
	<header class="flex flex-col gap-4">
		<h1 class="text-3xl md:text-4xl">
			{data.filters.q ? `Resultados para «${data.filters.q}»` : 'Todos los productos'}
		</h1>
		<form method="GET" role="search" class="relative max-w-xl" data-sveltekit-keepfocus>
			<label for="search-page" class="sr-only">Buscar productos</label>
			<Search
				size={18}
				stroke-width={1.75}
				class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
			/>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="search-page"
				name="q"
				type="search"
				value={data.filters.q}
				placeholder="Busca un personaje, anime o producto"
				autofocus={!data.filters.q}
				class="h-12 w-full rounded-full border border-border bg-surface pr-4 pl-11 text-base text-foreground placeholder:text-muted-foreground focus:border-purple-light focus:outline-none"
			/>
		</form>
	</header>

	{#if data.total}
		<CatalogFilters
			filters={data.filters}
			facets={data.facets}
			collections={data.collections}
			total={data.products.length}
		>
			<ProductGrid products={data.products} preferredColors={data.filters.colores}>
				{#snippet empty()}
					<EmptyState title="No encontramos coincidencias">
						Revisa cómo lo escribiste o busca algo más general. Si no lo tenemos, podemos hacerlo
						como encargo especial.
					</EmptyState>
				{/snippet}
			</ProductGrid>
		</CatalogFilters>
	{:else}
		<EmptyState title="Estamos subiendo el catálogo">Vuelve muy pronto.</EmptyState>
	{/if}
</div>
