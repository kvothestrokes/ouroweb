<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { resolve } from '$app/paths';
	import CatalogFilters from '#lib/components/store/CatalogFilters.svelte';
	import CategoryHero from '#lib/components/store/CategoryHero.svelte';
	import CategorySubnav from '#lib/components/store/CategorySubnav.svelte';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import { imageUrl, productImages } from '#lib/domain/store-product.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const isRoot = $derived(data.category.id === data.root.id);
	const starImage = $derived(
		data.star?.product ? (productImages(data.star.product)[0] ?? null) : null
	);
	const shareImage = $derived(
		starImage ?? (data.products[0] ? (productImages(data.products[0])[0] ?? null) : null)
	);
</script>

<Seo
	title="{data.category.nombre} — Ouroboros"
	description="{data.category
		.nombre} con diseños de anime y cultura pop. Pide por WhatsApp en Ouroboros."
	image={shareImage ? imageUrl(shareImage, 1000) : null}
/>

{#if data.root.children.length}
	<CategorySubnav parent={data.root} items={data.root.children} active={data.category.slug} />
{/if}

<div class="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 md:px-6 md:py-10">
	<header class="flex flex-col gap-1">
		{#if !isRoot}
			<a
				href={resolve('/(store)/c/[categoria]', { categoria: data.root.slug })}
				class="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground"
			>
				{data.root.nombre}
			</a>
		{/if}
		<h1 class="text-3xl md:text-4xl">{data.category.nombre}</h1>
	</header>

	{#if data.star}
		<CategoryHero
			eyebrow="Lo más pedido"
			title={data.star.nombre}
			text="Nuestra especialidad en {data.root.nombre.toLowerCase()}: elige tu diseño, color y talla."
			href={resolve('/(store)/c/[categoria]', { categoria: data.star.slug })}
			cta="Ver {data.star.nombre.toLowerCase()}"
			image={starImage}
		/>
	{/if}

	{#if data.total}
		<CatalogFilters
			filters={data.filters}
			facets={data.facets}
			collections={data.collections}
			total={data.products.length}
		>
			<ProductGrid products={data.products} preferredColors={data.filters.colores}>
				{#snippet empty()}
					<EmptyState title="Nada con esos filtros">
						Prueba quitando alguno para ver más diseños.
						{#snippet action()}
							<a
								href={resolve('/(store)/c/[categoria]', { categoria: data.category.slug })}
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
		<EmptyState title="Muy pronto">
			Estamos preparando los productos de {data.category.nombre.toLowerCase()}. Vuelve en unos días
			o pregúntanos por WhatsApp.
		</EmptyState>
	{/if}
</div>
