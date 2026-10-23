<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { StoreProduct } from '#lib/domain/store-product.js';
	import ProductCard from './ProductCard.svelte';

	type Props = {
		products: StoreProduct[];
		empty?: Snippet;
		eagerCount?: number;
		preferredColors?: string[];
	};

	let { products, empty, eagerCount = 4, preferredColors }: Props = $props();
</script>

{#if products.length}
	<ul class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
		{#each products as product, i (product.id)}
			<li><ProductCard {product} eager={i < eagerCount} {preferredColors} /></li>
		{/each}
	</ul>
{:else if empty}
	{@render empty()}
{/if}
