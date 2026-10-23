<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import ColorSwatches from '#lib/components/store/ColorSwatches.svelte';
	import FandomBadge from '#lib/components/store/FandomBadge.svelte';
	import FavoriteButton from '#lib/components/store/FavoriteButton.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import ProtectedImage from '#lib/components/store/ProtectedImage.svelte';
	import ReviewList from '#lib/components/store/ReviewList.svelte';
	import SizeGuide from '#lib/components/store/SizeGuide.svelte';
	import StockBadge from '#lib/components/store/StockBadge.svelte';
	import { stageTint } from '#lib/domain/color.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { availableSizes, imageUrl, productImages } from '#lib/domain/store-product.js';
	import { MAX_QUANTITY, cart } from '#lib/stores/cart.svelte.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const product = $derived(data.product);
	const images = $derived(productImages(product));
	const isGarment = $derived(product.todasLasTallas.length > 0);

	// Selection: writable deriveds, so they start over when navigating to another product.
	/** Color from the card (`#color=negro`), else the first one with stock. */
	let color = $derived.by(() => {
		const initial = new URLSearchParams(page.url.hash.slice(1)).get('color');
		if (initial && product.colores.includes(initial)) return initial;
		return (
			product.colores.find((key) => availableSizes(product, key).length) ??
			product.colores[0] ??
			null
		);
	});
	let pickedSize = $derived.by<string | null>(() => (void product.id, null));
	let cantidad = $derived.by(() => (void product.id, 1));
	let personalizar = $derived.by(() => (void product.id, false));
	let texto = $derived.by(() => (void product.id, ''));
	let photoIndex = $derived.by(() => (void product.id, 0));
	/** Selection that was last added, to confirm it until something changes. */
	let addedSelection = $derived.by<string | null>(() => (void product.id, null));
	let showErrors = $derived.by(() => (void product.id, false));

	const sizes = $derived(availableSizes(product, color));
	const isMockup = $derived(product.tipoImagen === 'mockup');
	/** Soft garment-color backdrop for mockups (their photos have a white background). */
	const tintFor = (key: string | null) => {
		const hex = product.colorOptions.find((option) => option.key === key)?.hex;
		return isMockup && hex ? stageTint(hex) : null;
	};
	const otherColors = $derived(
		product.colorOptions.filter((option) => option.key !== color).slice(0, 4)
	);
	/** A size not available in the chosen color counts as not chosen. */
	const talla = $derived(pickedSize && sizes.includes(pickedSize) ? pickedSize : null);
	const colorName = $derived(product.colorOptions.find((option) => option.key === color)?.nombre);
	const image = $derived(
		product.tipoImagen === 'mockup'
			? (images.find((item) => item.key === color) ?? images[0])
			: images[photoIndex]
	);
	const unitPrice = $derived(
		product.precioBase === null
			? null
			: product.precioBase + (talla ? (product.recargos[talla] ?? 0) : 0)
	);
	/** Regular price with the same size surcharge, crossed out while an offer runs. */
	const regularPrice = $derived(
		product.precioNormalBase === null
			? null
			: product.precioNormalBase + (talla ? (product.recargos[talla] ?? 0) : 0)
	);
	const surchargeSizes = $derived(sizes.filter((size) => product.recargos[size]));
	const missing = $derived(
		[
			product.colores.length && !color ? 'un color' : null,
			isGarment && !talla ? 'una talla' : null
		].filter(Boolean) as string[]
	);
	const soldOut = $derived(isGarment && !product.bajoPedido && sizes.length === 0);

	/** The typed quantity, kept valid while the field is being edited. */
	const qty = $derived(
		Number.isInteger(cantidad) && cantidad >= 1 ? Math.min(MAX_QUANTITY, cantidad) : 1
	);
	const selection = $derived(
		JSON.stringify([product.slug, color, talla, qty, personalizar, texto])
	);
	const added = $derived(addedSelection === selection);

	function addToCart() {
		if (missing.length) {
			showErrors = true;
			return;
		}
		cart.add({
			slug: product.slug,
			color: product.tipoImagen === 'mockup' || product.colores.length ? color : null,
			talla: isGarment ? talla : null,
			cantidad: qty,
			personalizacion: personalizar && texto.trim() ? texto.trim().slice(0, 500) : null
		});
		addedSelection = selection;
		showErrors = false;
	}

	const description = $derived(
		product.descripcion ||
			`${product.nombre}${product.fandom ? ` de ${product.fandom}` : ''}. Pide el tuyo en Ouroboros.`
	);
</script>

<Seo
	title="{product.nombre} — Ouroboros"
	{description}
	type="product"
	image={images[0] ? imageUrl(images[0], 1000) : null}
/>

<div class="mx-auto max-w-7xl px-4 pt-6 pb-32 md:px-6 md:pt-10 lg:pb-10">
	<nav aria-label="Ruta" class="mb-6 text-sm text-muted-foreground">
		<ol class="flex flex-wrap items-center gap-1.5">
			<li>
				<a
					href={resolve('/(store)')}
					class="inline-flex min-h-11 items-center hover:text-foreground">Inicio</a
				>
			</li>
			{#if data.root}
				<li aria-hidden="true">/</li>
				<li>
					<a
						href={resolve('/(store)/c/[categoria]', { categoria: data.root.slug })}
						class="inline-flex min-h-11 items-center hover:text-foreground">{data.root.nombre}</a
					>
				</li>
			{/if}
			<li aria-hidden="true">/</li>
			<li>
				<a
					href={resolve('/(store)/c/[categoria]', { categoria: data.category.slug })}
					class="inline-flex min-h-11 items-center hover:text-foreground">{data.category.nombre}</a
				>
			</li>
		</ol>
	</nav>

	<div class="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
		<!-- Gallery -->
		<div class="flex flex-col gap-3">
			<div class="relative overflow-hidden rounded-[28px]">
				{#if image}
					<ProtectedImage
						{image}
						eager
						tint={tintFor(color)}
						blend={isMockup}
						alt={colorName ? `${product.nombre} en color ${colorName}` : product.nombre}
						sizes="(min-width: 1024px) 55vw, 100vw"
						class="aspect-[4/5]"
					/>
				{:else}
					<div class="grid aspect-[4/5] place-items-center text-muted-foreground product-stage">
						Foto próximamente
					</div>
				{/if}
			</div>
			{#if isMockup && otherColors.length}
				<ul class="hidden grid-cols-2 gap-3 lg:grid" aria-label="Otros colores">
					{#each otherColors as option (option.key)}
						{@const preview = images.find((item) => item.key === option.key)}
						{#if preview}
							<li>
								<button
									type="button"
									onclick={() => (color = option.key)}
									aria-label="Ver en color {option.nombre}"
									class="block w-full overflow-hidden rounded-[22px] transition-transform hover:-translate-y-0.5"
								>
									<ProtectedImage
										image={preview}
										alt=""
										sizes="25vw"
										tint={tintFor(option.key)}
										blend
										class="aspect-square"
									/>
								</button>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
			{#if product.tipoImagen === 'foto' && images.length > 1}
				<ul class="flex gap-2 overflow-x-auto" aria-label="Fotos">
					{#each images as photo, i (photo.key)}
						<li class="shrink-0">
							<button
								type="button"
								onclick={() => (photoIndex = i)}
								aria-label="Ver foto {i + 1}"
								aria-pressed={i === photoIndex}
								class={cn(
									'block w-20 overflow-hidden rounded-lg border-2 transition-colors',
									i === photoIndex
										? 'border-gold'
										: 'border-transparent opacity-70 hover:opacity-100'
								)}
							>
								<ProtectedImage image={photo} alt="" sizes="80px" class="aspect-square" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Buy panel -->
		<div class="lg:sticky lg:top-24 lg:self-start">
			<div class="flex flex-col gap-6">
				<div class="flex flex-col gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<StockBadge enStock={product.enStock} />
						{#if product.fandom}<FandomBadge nombre={product.fandom} />{/if}
					</div>
					<div class="flex items-start justify-between gap-4">
						<h1 class="font-display text-3xl leading-tight font-bold md:text-4xl">
							{product.nombre}
						</h1>
						<FavoriteButton
							slug={product.slug}
							nombre={product.nombre}
							variant="outline"
							class="shrink-0"
						/>
					</div>
					<p
						class={cn(
							'flex flex-wrap items-baseline gap-x-3 text-3xl font-bold tabular-nums',
							regularPrice !== null ? 'text-sale' : 'text-foreground'
						)}
					>
						{#if unitPrice !== null}
							{formatMoney(unitPrice)}
							{#if regularPrice !== null}
								<s class="text-base font-normal text-muted-foreground">
									<span class="sr-only">Antes</span>
									{formatMoney(regularPrice)}
								</s>
								<span class="rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-overlay"
									>Oferta −{Math.round((1 - unitPrice / regularPrice) * 100)}%</span
								>
							{/if}
						{:else}
							<span class="text-lg font-normal text-muted-foreground">Precio por cotizar</span>
						{/if}
					</p>
				</div>

				{#if product.colorOptions.length}
					<fieldset class="flex flex-col gap-2">
						<legend class="mb-2 text-sm">
							Color: <span class="text-muted-foreground">{colorName ?? 'elige uno'}</span>
						</legend>
						{#if isMockup && product.colorOptions.length <= 8}
							<div class="flex flex-wrap gap-2">
								{#each product.colorOptions as option (option.key)}
									{@const preview = images.find((item) => item.key === option.key)}
									<button
										type="button"
										onclick={() => (color = option.key)}
										aria-label="Color {option.nombre}"
										aria-pressed={color === option.key}
										title={option.nombre}
										class={cn(
											'w-14 overflow-hidden rounded-xl border-2 transition-colors',
											color === option.key
												? 'border-foreground'
												: 'border-transparent hover:border-border'
										)}
									>
										{#if preview}
											<ProtectedImage
												image={preview}
												alt=""
												sizes="56px"
												tint={tintFor(option.key)}
												blend
												class="aspect-[7/8]"
											/>
										{/if}
									</button>
								{/each}
							</div>
						{:else}
							<ColorSwatches
								colors={product.colorOptions}
								selected={color}
								onselect={(key) => (color = key)}
								size="md"
							/>
						{/if}
					</fieldset>
				{/if}

				{#if isGarment}
					<fieldset class="relative flex flex-col gap-2">
						<legend class="mb-2 flex min-h-11 items-center text-sm">
							Talla: <span class="ml-1 text-muted-foreground">{talla ?? 'elige una'}</span>
						</legend>
						<div class="absolute top-0 right-0">
							<SizeGuide
								guide={product.guiaTallas}
								sizes={product.todasLasTallas}
								garment={product.prenda ?? 'Prenda'}
							/>
						</div>
						{#if soldOut}
							<p class="text-sm text-warning">
								Este color se agotó. Prueba otro o pregúntanos por WhatsApp.
							</p>
						{/if}
						<div class="flex flex-wrap gap-2">
							{#each product.todasLasTallas as size (size)}
								{@const available = sizes.includes(size)}
								<button
									type="button"
									disabled={!available}
									aria-pressed={talla === size}
									onclick={() => (pickedSize = size)}
									class={cn(
										'flex min-h-12 min-w-14 flex-col items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors',
										talla === size
											? 'border-primary bg-primary text-primary-foreground'
											: 'border-border bg-card hover:border-foreground',
										!available && 'cursor-not-allowed text-muted-foreground/50 line-through'
									)}
								>
									{size}
									{#if available && product.recargos[size]}
										<span class="text-[11px] text-muted-foreground tabular-nums">
											+{formatMoney(product.recargos[size])}
										</span>
									{/if}
								</button>
							{/each}
						</div>
						{#if surchargeSizes.length}
							<p class="text-xs text-muted-foreground">
								Las tallas {surchargeSizes.join(', ')} tienen un pequeño recargo por el material extra.
							</p>
						{/if}
						{#if showErrors && !talla}
							<p class="text-sm text-danger" role="alert">Elige tu talla.</p>
						{/if}
					</fieldset>
				{/if}

				<div class="flex flex-col gap-2">
					<span id="qty-label" class="text-sm">Cantidad</span>
					<div
						class="flex w-fit items-center rounded-full border border-border"
						role="group"
						aria-labelledby="qty-label"
					>
						<button
							type="button"
							aria-label="Quitar una pieza"
							disabled={cantidad <= 1}
							onclick={() => (cantidad = Math.max(1, cantidad - 1))}
							class="grid size-11 place-items-center rounded-full hover:bg-surface-raised disabled:opacity-40"
						>
							<Minus size={16} stroke-width={1.75} />
						</button>
						<input
							type="number"
							inputmode="numeric"
							min="1"
							max={MAX_QUANTITY}
							aria-label="Cantidad"
							bind:value={cantidad}
							onchange={() =>
								(cantidad = Math.max(1, Math.min(MAX_QUANTITY, Math.trunc(cantidad) || 1)))}
							class="w-12 [appearance:textfield] bg-transparent text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none"
						/>
						<button
							type="button"
							aria-label="Agregar una pieza"
							disabled={cantidad >= MAX_QUANTITY}
							onclick={() => (cantidad = Math.min(MAX_QUANTITY, cantidad + 1))}
							class="grid size-11 place-items-center rounded-full hover:bg-surface-raised disabled:opacity-40"
						>
							<Plus size={16} stroke-width={1.75} />
						</button>
					</div>
					{#if product.mayoreo}
						{@const missingPieces = Math.max(0, product.mayoreo.cantidadMin - qty)}
						<div
							class="mt-1 flex flex-col gap-2 rounded-2xl bg-gold-fill/15 p-4"
							aria-live="polite"
						>
							<p class="text-sm">
								{#if missingPieces}
									<strong>Precio de mayoreo:</strong> agrega {missingPieces}
									{missingPieces === 1 ? 'pieza' : 'piezas'} más y paga {formatMoney(
										product.mayoreo.precio
									)} c/u.
								{:else}
									<strong class="text-success">¡Precio de mayoreo!</strong>
									{formatMoney(product.mayoreo.precio)} c/u al confirmar tu pedido.
								{/if}
							</p>
							<span class="h-1.5 overflow-hidden rounded-full bg-gold-fill/25" aria-hidden="true">
								<span
									class="block h-full rounded-full bg-gold-fill transition-[width] duration-300"
									style:width="{Math.min(100, (qty / product.mayoreo.cantidadMin) * 100)}%"
								></span>
							</span>
						</div>
					{:else if isGarment}
						<p class="text-sm text-muted-foreground">
							¿Vas a pedir varias? Pregúntanos por precio de mayoreo.
						</p>
					{/if}
				</div>

				{#if product.permitePersonalizar}
					<div
						class={cn(
							'flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors',
							personalizar ? 'border-purple-light bg-accent/8' : 'border-accent/40'
						)}
					>
						<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
							<input type="checkbox" bind:checked={personalizar} class="size-5 accent-gold" />
							<span class="font-semibold text-purple-light">
								Personalízala: tu nombre, otra frase o tu idea
								<span class="block text-xs font-normal text-muted-foreground"
									>Personalización por cotizar</span
								>
							</span>
						</label>
						{#if personalizar}
							<label class="flex flex-col gap-2 text-sm">
								<span>¿Qué quieres que agreguemos?</span>
								<textarea
									bind:value={texto}
									maxlength="500"
									rows="3"
									placeholder="Ej. tu nombre en la espalda, otra frase, cambiar un color…"
									class="rounded-md border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:border-purple-light"
								></textarea>
								<span class="text-xs text-muted-foreground">
									Si tienes una imagen de referencia, mándala por WhatsApp al confirmar tu pedido.
								</span>
							</label>
						{/if}
					</div>
				{/if}

				<div class="hidden flex-col gap-3 lg:flex">
					{@render addButton()}
				</div>

				{#if product.descripcion}
					<div class="border-t border-border pt-6">
						<h2
							class="mb-2 font-sans text-sm font-medium tracking-widest text-muted-foreground uppercase"
						>
							Descripción
						</h2>
						<p class="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
							{product.descripcion}
						</p>
					</div>
				{/if}
				<p class="text-xs text-muted-foreground">
					{product.bajoPedido
						? 'Bajo pedido: lo producimos cuando confirmas tu anticipo.'
						: 'En stock: listo para entregar después de confirmar tu pedido.'}
					El envío y los detalles los cotizamos contigo por WhatsApp.
				</p>
			</div>
		</div>
	</div>

	{#if data.reviews.length}
		<section class="mt-20" aria-labelledby="resenas">
			<h2 id="resenas" class="mb-6 text-2xl">Lo que dicen nuestros clientes</h2>
			<ReviewList reviews={data.reviews} />
		</section>
	{/if}

	{#if data.related.length}
		<section class="mt-20">
			<h2 class="mb-6 text-2xl">También te puede gustar</h2>
			<ProductGrid products={data.related} eagerCount={0} />
		</section>
	{/if}
</div>

<!-- Mobile buy bar -->
<div
	class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
>
	<div class="mx-auto flex max-w-xl items-center gap-3">
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs text-muted-foreground">
				{[colorName, talla ? `Talla ${talla}` : null, qty > 1 ? `${qty} pzas` : null]
					.filter(Boolean)
					.join(' · ') || product.nombre}
			</p>
			<p class="font-semibold text-gold tabular-nums">
				{unitPrice !== null ? formatMoney(unitPrice * qty) : 'Por cotizar'}
			</p>
		</div>
		<div class="flex-[1.4]">{@render addButton(true)}</div>
	</div>
</div>

{#snippet addButton(compact = false)}
	{#if showErrors && missing.length && compact}
		<p class="sr-only" role="alert">Elige {missing.join(' y ')}.</p>
	{/if}
	{#if compact && added}
		<a
			href={resolve('/(store)/carrito')}
			class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
		>
			<Check size={18} stroke-width={1.75} />
			Ver carrito
		</a>
	{:else}
		<button
			type="button"
			onclick={addToCart}
			disabled={soldOut}
			class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if added}
				<Check size={18} stroke-width={1.75} />
				{compact ? 'Agregado' : 'Agregado al carrito'}
			{:else}
				<ShoppingBag size={18} stroke-width={1.75} />
				{compact && missing.length
					? `Elige ${missing[0].replace(/^una? /, '')}`
					: 'Agregar al carrito'}
			{/if}
		</button>
	{/if}
	{#if !compact}
		<div aria-live="polite" class="min-h-5 text-sm">
			{#if added}
				<span class="text-success">Listo, está en tu carrito.</span>
				<a href={resolve('/(store)/carrito')} class="ml-1 text-purple-light underline"
					>Ver carrito</a
				>
			{:else if showErrors && missing.length}
				<span class="text-danger">Elige {missing.join(' y ')}.</span>
			{/if}
		</div>
	{/if}
{/snippet}
