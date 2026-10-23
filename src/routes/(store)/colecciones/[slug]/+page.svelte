<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { imageUrl, productImages } from '#lib/domain/store-product.js';
	import { resolve } from '$app/paths';
	import CatalogFilters from '#lib/components/store/CatalogFilters.svelte';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="{data.collection.nombre} — Colecciones — Ouroboros"
	description="Playeras, sudaderas y regalos de {data.collection
		.nombre}. Pide por WhatsApp en Ouroboros."
	image={data.products[0] && productImages(data.products[0])[0]
		? imageUrl(productImages(data.products[0])[0], 1000)
		: null}
/>

<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
	<header class="flex flex-col gap-1">
		<a
			href={resolve('/(store)/colecciones')}
			class="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground"
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
					<EmptyState title="Nada con esos filtros">
						Prueba quitando alguno.
						{#snippet action()}
							<a
								href={resolve('/(store)/colecciones/[slug]', { slug: data.collection.slug })}
								class="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm hover:bg-surface-raised"
							>
								Quitar filtros
							</a>
						{/snippet}
					</EmptyState>
				{/snippet}
			</ProductGrid>
		</CatalogFilters>
	{:else}
		<EmptyState title="Muy pronto">Estamos preparando los diseños de esta colección.</EmptyState>
	{/if}
</div>
