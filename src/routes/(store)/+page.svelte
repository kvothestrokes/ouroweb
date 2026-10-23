<script lang="ts">
	import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Star from '@lucide/svelte/icons/star';
	import Truck from '@lucide/svelte/icons/truck';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import ProtectedImage from '#lib/components/store/ProtectedImage.svelte';
	import Seo from '#lib/components/store/Seo.svelte';
	import { stageTint } from '#lib/domain/color.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { imageUrl } from '#lib/domain/store-product.js';
	import { whatsappLink } from '#lib/domain/whatsapp.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Cover = NonNullable<(typeof data.hero)[number]['cover']>;
	const tintOf = (cover: Cover) => (cover.hex ? stageTint(cover.hex) : null);

	const FILTERS = [
		{ id: 'todo', label: 'Todo' },
		{ id: 'oferta', label: 'En oferta' },
		{ id: 'stock', label: 'En stock' }
	] as const;
	let filter = $state<(typeof FILTERS)[number]['id']>('todo');
	const newest = $derived(
		filter === 'oferta'
			? data.newest.filter((product) => product.precioNormal !== null)
			: filter === 'stock'
				? data.newest.filter((product) => product.enStock)
				: data.newest
	);

	// Category tiles cycle through brand surfaces; the first one shows a product photo.
	const TILE_STYLES = [
		'bg-gold-fill text-on-gold',
		'bg-primary text-primary-foreground',
		'bg-accent/15 text-foreground',
		'bg-surface-raised text-foreground'
	];

	const firstHero = $derived(data.hero[0]);
	const shareImage = $derived(firstHero?.cover ? imageUrl(firstHero.cover.image, 1000) : null);
	const chip =
		'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors';
</script>

<Seo
	title="Ouroboros — Playeras y regalos de anime y cultura pop"
	description="Playeras, sudaderas, tazas, termos, stickers, velas e impresiones 3D con diseños de anime y cultura pop. Pide por WhatsApp."
	image={shareImage}
/>

<!-- Hero: editorial copy + product collage -->
<section
	class="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-8 pb-14 md:px-6 lg:grid-cols-2 lg:pt-14 lg:pb-20"
>
	<div class="flex flex-col items-start gap-5">
		<span
			class="rounded-full bg-accent/12 px-3.5 py-1.5 text-xs font-semibold tracking-[0.14em] text-purple-light uppercase"
		>
			Anime · Gaming · Cultura pop
		</span>
		<h1
			class="font-display text-5xl leading-[0.95] font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-8xl"
		>
			Lleva tu<br />fandom<br /><span class="text-gold">puesto.</span>
		</h1>
		<p class="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
			Playeras, sudaderas y regalos con diseños originales. Elige color y talla; lo confirmamos
			contigo por WhatsApp.
		</p>
		<div class="flex flex-wrap gap-3 pt-2">
			<a
				href="#novedades"
				class="inline-flex min-h-13 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
			>
				Comprar ahora <ArrowRight size={16} stroke-width={2} />
			</a>
			<a
				href={resolve('/(store)/encargos')}
				class="inline-flex min-h-13 items-center gap-2 rounded-full border-2 border-foreground px-6 text-sm font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
			>
				Pide algo personalizado
			</a>
		</div>
	</div>

	<div class="relative h-[420px] sm:h-[520px]" aria-hidden={data.hero.length === 0}>
		{#if data.hero.length}
			{#each data.hero as item, i (item.product.id)}
				{#if item.cover}
					<a
						href={resolve('/(store)/p/[producto]', { producto: item.product.slug })}
						class={cn(
							'absolute overflow-hidden rounded-[28px] shadow-xl transition-transform duration-500 hover:-translate-y-1',
							i === 0 && 'top-8 left-0 h-[78%] w-[56%]',
							i === 1 && 'top-0 right-0 h-[58%] w-[48%]',
							i === 2 && 'right-4 bottom-0 h-[38%] w-[44%]'
						)}
					>
						<ProtectedImage
							image={item.cover.image}
							alt={item.product.nombre}
							sizes="(min-width: 1024px) 30vw, 60vw"
							tint={tintOf(item.cover)}
							blend={item.cover.blend}
							eager={i === 0}
							class="size-full"
						/>
					</a>
				{/if}
			{/each}
			{#if firstHero?.product.precio != null}
				<div
					class="absolute bottom-[14%] left-[38%] z-10 flex flex-col rounded-2xl bg-overlay px-4 py-3 text-overlay-foreground shadow-2xl"
				>
					<span class="text-xs opacity-70">{firstHero.product.nombre}</span>
					<span class="text-base font-bold tabular-nums">
						{formatMoney(firstHero.product.precio)}
						{#if firstHero.product.precioNormal}
							<s class="ml-1 text-xs font-normal opacity-60"
								>{formatMoney(firstHero.product.precioNormal)}</s
							>
						{/if}
					</span>
				</div>
			{/if}
		{:else}
			<div
				class="absolute inset-0 grid place-items-center rounded-[32px] bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--color-gold-fill)_30%,transparent),transparent_65%)]"
			>
				<img
					src="/brand/ourologo.webp"
					alt=""
					class="size-56 rounded-full object-cover shadow-2xl"
				/>
			</div>
		{/if}
		<span
			class="absolute top-4 right-[40%] grid size-20 rotate-[-12deg] place-items-center rounded-full bg-gold-fill text-center font-display text-sm leading-tight font-bold text-on-gold shadow-lg"
			aria-hidden="true"
		>
			Nuevo<br />drop
		</span>
	</div>
</section>

<!-- Shop by fandom (stories) -->
{#if data.fandoms.length}
	<section class="mx-auto max-w-7xl px-4 pb-14 md:px-6" aria-labelledby="fandoms">
		<div class="mb-5 flex items-end justify-between gap-4">
			<h2 id="fandoms" class="text-2xl md:text-3xl">Compra por fandom</h2>
			<a
				href={resolve('/(store)/colecciones')}
				class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-purple-light hover:underline"
			>
				Todas <ArrowRight size={16} stroke-width={1.75} />
			</a>
		</div>
		<ul
			class="flex [scrollbar-width:none] gap-4 overflow-x-auto pb-2 md:gap-6 [&::-webkit-scrollbar]:hidden"
		>
			{#each data.fandoms as fandom, i (fandom.id)}
				<li class="shrink-0">
					<a
						href={resolve('/(store)/colecciones/[slug]', { slug: fandom.slug })}
						class="group flex w-20 flex-col items-center gap-2 text-center md:w-28"
					>
						<span
							class={cn(
								'rounded-full p-[3px] transition-transform group-hover:scale-105',
								i < 3
									? 'bg-[conic-gradient(var(--color-gold-fill),var(--color-purple),var(--color-sale),var(--color-gold-fill))]'
									: 'bg-border'
							)}
						>
							<span class="block overflow-hidden rounded-full border-[3px] border-background">
								{#if fandom.cover}
									<ProtectedImage
										image={fandom.cover.image}
										alt=""
										sizes="112px"
										tint={tintOf(fandom.cover)}
										blend={fandom.cover.blend}
										class="size-[68px] md:size-24"
									/>
								{:else}
									<span class="block size-[68px] product-stage md:size-24"></span>
								{/if}
							</span>
						</span>
						<span class="text-xs font-semibold text-foreground md:text-sm">{fandom.nombre}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- Category mosaic -->
<section class="mx-auto max-w-7xl px-4 pb-16 md:px-6" aria-labelledby="categorias">
	<h2 id="categorias" class="sr-only">Categorías</h2>
	<ul class="grid auto-rows-[150px] grid-cols-2 gap-3 md:auto-rows-[200px] md:grid-cols-3 md:gap-4">
		{#each data.categoryCovers as category, i (category.id)}
			{@const first = i === 0}
			<li
				class={cn(
					first && 'col-span-2 row-span-2',
					// On phones an odd tile left at the end takes the whole row.
					!first &&
						i === data.categoryCovers.length - 1 &&
						i % 2 === 1 &&
						'col-span-2 md:col-span-1'
				)}
			>
				<a
					href={resolve('/(store)/c/[categoria]', { categoria: category.slug })}
					class={cn(
						'group relative flex size-full flex-col justify-between overflow-hidden rounded-[24px] p-5 transition-transform hover:-translate-y-0.5',
						first ? 'text-overlay-foreground' : TILE_STYLES[(i - 1) % TILE_STYLES.length]
					)}
				>
					{#if first}
						{#if category.cover}
							<ProtectedImage
								image={category.cover.image}
								alt=""
								sizes="(min-width: 768px) 50vw, 100vw"
								tint={tintOf(category.cover)}
								blend={category.cover.blend}
								class="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]"
							/>
						{:else}
							<span class="absolute inset-0 product-stage"></span>
						{/if}
						<span class="relative mt-auto flex flex-col items-start gap-3">
							<span class="font-display text-4xl font-bold md:text-5xl">{category.nombre}</span>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-overlay-foreground px-4 py-2 text-sm font-semibold text-overlay"
							>
								Ver todo <ArrowRight size={14} stroke-width={2} />
							</span>
						</span>
					{:else}
						<span class="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
							{category.subcategorias.join(' · ') || 'Ver todo'}
						</span>
						<span
							class="font-display text-lg leading-tight font-bold hyphens-auto sm:text-2xl md:text-3xl"
							>{category.nombre}</span
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</section>

<!-- New arrivals -->
<section id="novedades" class="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20 md:px-6">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-2xl md:text-3xl">Lo más nuevo</h2>
		<div class="flex gap-2" role="group" aria-label="Filtrar novedades">
			{#each FILTERS as option (option.id)}
				<button
					type="button"
					aria-pressed={filter === option.id}
					onclick={() => (filter = option.id)}
					class={cn(
						chip,
						filter === option.id
							? 'border-transparent bg-primary text-primary-foreground'
							: 'border-border text-foreground hover:border-foreground'
					)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
	<ProductGrid products={newest}>
		{#snippet empty()}
			<EmptyState
				title={data.total ? 'Nada por aquí con ese filtro' : 'Estamos subiendo el catálogo'}
			>
				{data.total
					? 'Prueba con otro filtro o mira todo el catálogo.'
					: 'Muy pronto verás aquí nuestros diseños. Mientras, escríbenos y te mandamos lo que tenemos.'}
				{#snippet action()}
					{#if data.total}
						<a
							href={resolve('/(store)/buscar')}
							class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
						>
							Ver todo
						</a>
					{:else}
						<ExternalLink
							href={whatsappLink(PUBLIC_WHATSAPP_NUMBER, 'Hola, ¿qué diseños tienen disponibles?')}
							class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
						>
							Escríbenos por WhatsApp
						</ExternalLink>
					{/if}
				{/snippet}
			</EmptyState>
		{/snippet}
	</ProductGrid>
	{#if data.total > data.newest.length}
		<div class="mt-10 flex justify-center">
			<a
				href={resolve('/(store)/buscar')}
				class="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-foreground px-7 text-sm font-semibold hover:bg-foreground hover:text-background"
			>
				Ver todo el catálogo <ArrowRight size={16} stroke-width={2} />
			</a>
		</div>
	{/if}
</section>

<!-- Featured collection -->
{#if data.spotlight}
	<section class="mx-auto max-w-7xl px-4 pb-20 md:px-6">
		<div
			class="grid overflow-hidden rounded-[32px] bg-primary text-primary-foreground md:min-h-[420px] md:grid-cols-2"
		>
			<div class="flex flex-col justify-center gap-4 p-8 md:p-14">
				<span class="text-xs font-semibold tracking-[0.2em] text-gold-fill uppercase"
					>Colección destacada</span
				>
				<h2 class="font-display text-4xl leading-none font-bold md:text-6xl">
					{data.spotlight.nombre}
				</h2>
				<p class="max-w-sm opacity-80">
					{data.spotlight.count}
					{data.spotlight.count === 1 ? 'diseño' : 'diseños'} para llevar tu fandom puesto.
				</p>
				<a
					href={resolve('/(store)/colecciones/[slug]', { slug: data.spotlight.slug })}
					class="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-gold-fill px-7 text-sm font-semibold text-on-gold transition-transform hover:-translate-y-0.5"
				>
					Ver la colección <ArrowRight size={16} stroke-width={2} />
				</a>
			</div>
			<div class="grid min-h-[260px] grid-cols-2">
				{#each data.spotlight.covers as item, i (i)}
					<ProtectedImage
						image={item.image}
						alt=""
						sizes="(min-width: 768px) 25vw, 50vw"
						tint={tintOf(item)}
						blend={item.blend}
						class="size-full"
					/>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- Customer photos -->
{#if data.ugc.length}
	<section class="mx-auto max-w-7xl px-4 pb-20 md:px-6" aria-labelledby="clientes">
		<div class="mb-6 flex items-end justify-between gap-4">
			<div>
				<h2 id="clientes" class="text-2xl md:text-3xl">Así lo llevan ustedes</h2>
				<p class="mt-1 text-sm text-muted-foreground">Fotos de reseñas de clientes</p>
			</div>
			<a
				href={resolve('/(store)/galeria')}
				class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-purple-light hover:underline"
			>
				Galería <ArrowRight size={16} stroke-width={1.75} />
			</a>
		</div>
		<ul
			class="flex [scrollbar-width:none] gap-3 overflow-x-auto md:grid md:grid-cols-5 md:overflow-visible [&::-webkit-scrollbar]:hidden"
		>
			{#each data.ugc as review (review.id)}
				<li class="relative w-44 shrink-0 overflow-hidden rounded-2xl md:w-auto">
					<img
						src={review.foto}
						alt="Foto de un cliente"
						loading="lazy"
						draggable="false"
						class="aspect-square w-full object-cover image-guard"
					/>
					<span
						class="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-overlay px-2.5 py-1 text-xs font-semibold text-overlay-foreground"
					>
						<Star size={12} class="fill-gold-fill text-gold-fill" aria-hidden="true" />
						{review.calificacion}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- Custom orders in 3 steps -->
<section class="mx-auto max-w-7xl px-4 pb-20 md:px-6">
	<div
		class="grid gap-8 rounded-[32px] bg-surface-raised p-7 md:p-12 lg:grid-cols-[1fr_2fr] lg:items-center"
	>
		<div class="flex flex-col items-start gap-4">
			<span class="text-xs font-semibold tracking-[0.2em] text-gold uppercase"
				>Encargos especiales</span
			>
			<h2 class="font-display text-3xl leading-tight font-bold md:text-4xl">
				¿Tienes una idea? Hagámosla realidad.
			</h2>
			<a
				href={resolve('/(store)/encargos')}
				class="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
			>
				<Sparkles size={16} stroke-width={1.75} /> Cotizar mi encargo
			</a>
		</div>
		<ol class="grid gap-3 sm:grid-cols-3">
			{#each [{ n: '01', t: 'Cuéntanos tu idea', d: 'Sube imágenes de referencia y dinos para cuándo la quieres.' }, { n: '02', t: 'Te cotizamos', d: 'Precio y tiempos por WhatsApp, sin compromiso.' }, { n: '03', t: 'Lo hacemos para ti', d: 'Sigue tu pedido con tu folio hasta que lo recibas.' }] as step (step.n)}
				<li class="flex flex-col gap-2 rounded-2xl bg-card p-5">
					<span class="font-display text-3xl font-bold text-gold">{step.n}</span>
					<strong class="text-base">{step.t}</strong>
					<span class="text-sm leading-relaxed text-muted-foreground">{step.d}</span>
				</li>
			{/each}
		</ol>
	</div>
</section>

<!-- Trust bar -->
<section class="mx-auto max-w-7xl px-4 md:px-6" aria-label="Cómo compras en Ouroboros">
	<ul class="grid gap-6 border-y border-border py-8 sm:grid-cols-2 lg:grid-cols-4">
		<li class="flex items-center gap-3">
			<span
				class="grid size-11 shrink-0 place-items-center rounded-full bg-accent/12 text-purple-light"
				><MessageCircle size={20} stroke-width={1.75} /></span
			>
			<span class="text-sm"
				><strong class="block">Confirmas por WhatsApp</strong><span class="text-muted-foreground"
					>Sin pagos en línea</span
				></span
			>
		</li>
		<li class="flex items-center gap-3">
			<span class="grid size-11 shrink-0 place-items-center rounded-full bg-gold-fill/20 text-gold"
				><HandCoins size={20} stroke-width={1.75} /></span
			>
			<span class="text-sm"
				><strong class="block">Anticipo y saldo</strong><span class="text-muted-foreground"
					>Pagas en partes</span
				></span
			>
		</li>
		<li class="flex items-center gap-3">
			<span class="grid size-11 shrink-0 place-items-center rounded-full bg-success/12 text-success"
				><Truck size={20} stroke-width={1.75} /></span
			>
			<span class="text-sm"
				><strong class="block">Envíos a todo México</strong><span class="text-muted-foreground"
					>O recoge en el taller</span
				></span
			>
		</li>
		<li class="flex items-center gap-3">
			<span
				class="grid size-11 shrink-0 place-items-center rounded-full bg-surface-raised text-foreground"
				><Sparkles size={20} stroke-width={1.75} /></span
			>
			<span class="text-sm"
				><strong class="block">Diseños originales</strong><span class="text-muted-foreground"
					>Y personalizados a tu gusto</span
				></span
			>
		</li>
	</ul>
</section>
