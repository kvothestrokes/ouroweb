<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import { favorites } from '#lib/stores/favorites.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let ready = $state(false);
	$effect(() => {
		favorites.load();
		ready = true;
	});

	const saved = $derived(
		favorites.slugs.flatMap((slug) => data.products.find((product) => product.slug === slug) ?? [])
	);
</script>

<svelte:head>
	<title>Mis favoritos — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
	<header>
		<h1 class="text-3xl md:text-4xl">Mis favoritos</h1>
		<p class="mt-2 text-sm text-muted-foreground">Se guardan solo en este navegador.</p>
	</header>

	{#if !ready}
		<ul
			class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4"
			aria-hidden="true"
		>
			{#each { length: 4 }, i (i)}
				<li class="flex flex-col gap-2">
					<div class="aspect-[4/5] animate-pulse rounded-lg bg-surface-raised"></div>
					<div class="h-4 w-3/4 animate-pulse rounded bg-surface-raised"></div>
					<div class="h-4 w-1/3 animate-pulse rounded bg-surface-raised"></div>
				</li>
			{/each}
		</ul>
	{:else}
		<ProductGrid products={saved}>
			{#snippet empty()}
				<EmptyState title="Aún no tienes favoritos">
					Toca el corazón de cualquier producto para guardarlo aquí.
					{#snippet action()}
						<a
							href={resolve('/(store)/buscar')}
							class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-gold-light"
						>
							Explorar la tienda
						</a>
					{/snippet}
				</EmptyState>
			{/snippet}
		</ProductGrid>
	{/if}
</div>
