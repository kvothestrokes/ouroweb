<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatMoney } from '#lib/domain/money.js';
	import { productImages, type StoreProduct } from '#lib/domain/store-product.js';
	import ColorSwatches from './ColorSwatches.svelte';
	import FandomBadge from './FandomBadge.svelte';
	import FavoriteButton from './FavoriteButton.svelte';
	import ProtectedImage from './ProtectedImage.svelte';
	import StockBadge from './StockBadge.svelte';

	type Props = {
		product: StoreProduct;
		eager?: boolean;
		/** Colors being filtered on: the card opens on the first one it has. */
		preferredColors?: string[];
	};

	let { product, eager = false, preferredColors = [] }: Props = $props();

	const images = $derived(productImages(product));
	let picked = $state<string | null>(null);
	const color = $derived(
		picked ??
			preferredColors.find((key) => product.colores.includes(key)) ??
			product.colores[0] ??
			null
	);
	const image = $derived(images.find((item) => item.key === color) ?? images[0]);
	const colorName = $derived(product.colorOptions.find((option) => option.key === color)?.nombre);
	// The picked color travels in the hash so the product page opens on it.
	const hash = $derived(color && product.tipoImagen === 'mockup' ? `color=${color}` : '');
</script>

<article class="group relative flex flex-col">
	<a
		href={resolve(`/(store)/p/[producto]#${hash}`, { producto: product.slug })}
		class="block rounded-lg focus-visible:outline-offset-4"
	>
		<div class="relative overflow-hidden rounded-lg">
			{#if image}
				<ProtectedImage
					{image}
					{eager}
					alt={colorName ? `${product.nombre} en color ${colorName}` : product.nombre}
					sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
					class="aspect-[4/5] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
				/>
			{:else}
				<div
					class="grid aspect-[4/5] place-items-center text-sm text-muted-foreground product-stage"
				>
					Foto próximamente
				</div>
			{/if}
		</div>
		<span class="sr-only">Ver {product.nombre}</span>
	</a>

	<FavoriteButton slug={product.slug} nombre={product.nombre} class="absolute top-2 right-2" />

	<div class="mt-2 flex flex-col gap-1.5">
		{#if product.colorOptions.length > 1}
			<ColorSwatches
				colors={product.colorOptions}
				selected={color}
				onselect={(key) => (picked = key)}
				previewOnHover
				max={3}
			/>
		{/if}
		<a
			href={resolve(`/(store)/p/[producto]#${hash}`, { producto: product.slug })}
			class="line-clamp-2 text-sm leading-snug text-foreground hover:text-gold-light"
		>
			{product.nombre}
		</a>
		<p class="text-sm">
			{#if product.precio !== null}
				<span class="text-muted-foreground">Desde</span>
				<span class="font-semibold text-gold tabular-nums">{formatMoney(product.precio)}</span>
			{:else}
				<span class="text-muted-foreground">Precio por cotizar</span>
			{/if}
		</p>
		<div class="flex flex-wrap items-center gap-1.5">
			<StockBadge enStock={product.enStock} />
			{#if product.fandom}
				<FandomBadge nombre={product.fandom} />
			{/if}
		</div>
	</div>
</article>
