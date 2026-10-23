<script lang="ts">
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { stageTint } from '#lib/domain/color.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { productImages, type StoreProduct } from '#lib/domain/store-product.js';
	import { cart } from '#lib/stores/cart.svelte.js';
	import { cn } from '#lib/utils.js';
	import ColorSwatches from './ColorSwatches.svelte';
	import FavoriteButton from './FavoriteButton.svelte';
	import ProtectedImage from './ProtectedImage.svelte';

	type Props = {
		product: StoreProduct;
		eager?: boolean;
		/** Colors being filtered on: the card opens on the first one it has. */
		preferredColors?: string[];
	};

	let { product, eager = false, preferredColors = [] }: Props = $props();

	const NEW_DAYS = 21;

	const images = $derived(productImages(product));
	let picked = $state<string | null>(null);
	const color = $derived(
		picked ??
			preferredColors.find((key) => product.colores.includes(key)) ??
			product.colores[0] ??
			null
	);
	const option = $derived(product.colorOptions.find((item) => item.key === color));
	const image = $derived(images.find((item) => item.key === color) ?? images[0]);
	const isMockup = $derived(product.tipoImagen === 'mockup');
	const tint = $derived(option && isMockup ? stageTint(option.hex) : null);
	// The picked color travels in the hash so the product page opens on it.
	const hash = $derived(color && isMockup ? `color=${color}` : '');

	const discount = $derived(
		product.precioNormal && product.precio !== null
			? Math.round((1 - product.precio / product.precioNormal) * 100)
			: 0
	);
	const isNew = $derived(Date.now() - Date.parse(product.creado) < NEW_DAYS * 86_400_000);

	// Quick add (made-to-order garments): sizes over the photo, on hover or with the + button.
	const quickAdd = $derived(
		product.bajoPedido && product.tallas.length > 0 && product.precio !== null
	);
	let sheetOpen = $state(false);
	let addedSize = $state<string | null>(null);

	function add(size: string) {
		cart.add({ slug: product.slug, color, talla: size, cantidad: 1, personalizacion: null });
		addedSize = size;
		setTimeout(() => {
			addedSize = null;
			sheetOpen = false;
		}, 1400);
	}
</script>

<article class="group relative flex flex-col">
	<div class="relative">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()d path plus the color hash -->
		<a
			href={resolve(`/(store)/p/[producto]#${hash}`, { producto: product.slug })}
			class="block rounded-2xl focus-visible:outline-offset-4"
		>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<div class="relative overflow-hidden rounded-2xl">
				{#if image}
					<ProtectedImage
						{image}
						{eager}
						{tint}
						blend={isMockup}
						alt={option ? `${product.nombre} en color ${option.nombre}` : product.nombre}
						sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
						class="aspect-[4/5] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
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

		<div class="pointer-events-none absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
			{#if discount > 0}
				<span
					class="rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold text-overlay dark:text-overlay-foreground"
				>
					−{discount}%
				</span>
			{:else if isNew}
				<span
					class="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground"
				>
					Nuevo
				</span>
			{/if}
		</div>

		<FavoriteButton
			slug={product.slug}
			nombre={product.nombre}
			class="absolute top-1.5 right-1.5"
		/>

		{#if quickAdd}
			<button
				type="button"
				onclick={() => (sheetOpen = !sheetOpen)}
				aria-expanded={sheetOpen}
				aria-label={sheetOpen ? 'Cerrar tallas' : `Agregar ${product.nombre} rápido`}
				class="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-overlay text-overlay-foreground shadow-md transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
			>
				{#if sheetOpen}<X size={18} stroke-width={2} />{:else}<Plus
						size={18}
						stroke-width={2}
					/>{/if}
			</button>
			<div
				class={cn(
					'absolute inset-x-2 bottom-2 rounded-xl bg-overlay/95 p-2.5 text-overlay-foreground shadow-lg backdrop-blur-sm transition-all duration-200',
					sheetOpen
						? 'visible translate-y-0 opacity-100'
						: 'invisible translate-y-2 opacity-0 md:group-focus-within:visible md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:opacity-100'
				)}
			>
				<p class="mb-2 text-xs font-semibold" aria-live="polite">
					{addedSize ? `Agregada en ${addedSize}` : 'Agregar rápido · elige talla'}
				</p>
				<div class="flex gap-1.5">
					{#each product.tallas as size (size)}
						<button
							type="button"
							onclick={() => add(size)}
							aria-label="Agregar talla {size} al carrito"
							class={cn(
								'flex min-h-10 flex-1 items-center justify-center rounded-lg border text-xs font-medium transition-colors',
								addedSize === size
									? 'border-transparent bg-overlay-foreground text-overlay'
									: 'border-overlay-line hover:border-overlay-foreground hover:bg-overlay-foreground hover:text-overlay'
							)}
						>
							{#if addedSize === size}<Check size={14} stroke-width={2.5} />{:else}{size}{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-3 flex flex-col gap-1">
		{#if product.colorOptions.length > 1}
			<ColorSwatches
				colors={product.colorOptions}
				selected={color}
				onselect={(key) => (picked = key)}
				previewOnHover
				max={4}
			/>
		{/if}
		{#if product.fandom}
			<span class="text-[11px] font-semibold tracking-wider text-purple-light uppercase">
				{product.fandom}
			</span>
		{/if}
		<a
			href={resolve('/(store)/p/[producto]', { producto: product.slug })}
			class="line-clamp-2 text-sm leading-snug font-medium text-foreground hover:text-purple-light"
		>
			{product.nombre}
		</a>
		<p class="flex flex-wrap items-baseline gap-x-2 text-sm">
			{#if product.precio !== null}
				<span
					class={cn(
						'font-bold tabular-nums',
						product.precioNormal ? 'text-sale' : 'text-foreground'
					)}
				>
					{formatMoney(product.precio)}
				</span>
				{#if product.precioNormal}
					<s class="text-xs text-muted-foreground tabular-nums">
						<span class="sr-only">antes</span>
						{formatMoney(product.precioNormal)}
					</s>
				{/if}
			{:else}
				<span class="text-muted-foreground">Precio por cotizar</span>
			{/if}
			{#if !product.bajoPedido}
				<span class="text-xs font-medium text-success">· En stock</span>
			{/if}
		</p>
	</div>
</article>
