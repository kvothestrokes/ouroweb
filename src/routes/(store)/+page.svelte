<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { imageUrl, productImages } from '#lib/domain/store-product.js';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import { resolve } from '$app/paths';
	import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProductGrid from '#lib/components/store/ProductGrid.svelte';
	import { whatsappLink } from '#lib/domain/whatsapp.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Ouroboros — Playeras y regalos de anime y cultura pop"
	description="Playeras, sudaderas, tazas, termos, stickers, velas e impresiones 3D con diseños de anime y cultura pop. Pide por WhatsApp."
	image={data.featured[0] ? imageUrl(productImages(data.featured[0])[0], 1000) : null}
/>

<!-- Hero -->
<section class="relative isolate overflow-hidden border-b border-border">
	<div
		class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_70%_0%,color-mix(in_oklab,var(--color-purple)_35%,transparent),transparent_70%),radial-gradient(ellipse_60%_50%_at_10%_100%,color-mix(in_oklab,var(--color-gold)_14%,transparent),transparent_70%)]"
		aria-hidden="true"
	></div>
	<div class="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 md:px-6 md:py-28">
		<p class="text-xs font-medium tracking-[0.3em] text-purple-light uppercase">
			Anime · Gaming · Cultura pop
		</p>
		<h1 class="max-w-3xl text-4xl leading-tight text-foreground md:text-6xl">
			Lleva tu fandom <span class="text-gold">puesto</span>
		</h1>
		<p class="max-w-xl text-base text-muted-foreground md:text-lg">
			Playeras, sudaderas y regalos con diseños originales. Elige tu color y talla, y confirmamos tu
			pedido por WhatsApp.
		</p>
		<div class="flex flex-wrap gap-3">
			<a
				href="#destacados"
				class="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light"
			>
				Ver la tienda
				<ArrowRight size={16} stroke-width={1.75} />
			</a>
			<a
				href={resolve('/(store)/encargos')}
				class="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-6 text-sm text-foreground transition-colors hover:border-purple-light/60 hover:bg-surface-raised"
			>
				<Sparkles size={16} stroke-width={1.75} />
				Pide algo personalizado
			</a>
		</div>
	</div>
</section>

<!-- Categories -->
<section class="mx-auto max-w-7xl px-4 pt-12 md:px-6" aria-labelledby="categorias">
	<h2 id="categorias" class="sr-only">Categorías</h2>
	<ul
		class="flex [scrollbar-width:none] gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-6 md:overflow-visible [&::-webkit-scrollbar]:hidden"
	>
		{#each data.categories as root (root.id)}
			<li class="shrink-0">
				<a
					href={resolve('/(store)/c/[categoria]', { categoria: root.slug })}
					class="group flex min-h-24 w-36 flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:border-gold/50 hover:bg-surface-raised md:w-auto"
				>
					<span class="font-display text-base text-foreground group-hover:text-gold"
						>{root.nombre}</span
					>
					<span class="text-xs text-muted-foreground">
						{root.children.length
							? `${root.children.length} ${root.children.length === 1 ? 'sección' : 'secciones'}`
							: 'Ver todo'}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<!-- Featured -->
<section id="destacados" class="mx-auto max-w-7xl scroll-mt-20 px-4 pt-16 md:px-6">
	<div class="mb-6 flex items-end justify-between gap-4">
		<h2 class="text-2xl md:text-3xl">Destacados</h2>
		{#if data.total > data.featured.length}
			<a
				href={resolve('/(store)/buscar')}
				class="inline-flex min-h-11 items-center gap-1 text-sm text-purple-light hover:underline"
			>
				Ver todo <ArrowRight size={16} stroke-width={1.75} />
			</a>
		{/if}
	</div>
	<ProductGrid products={data.featured}>
		{#snippet empty()}
			<EmptyState title="Estamos subiendo el catálogo">
				Muy pronto verás aquí nuestros diseños. Mientras tanto, escríbenos y te mandamos lo que
				tenemos disponible.
				{#snippet action()}
					<ExternalLink
						href={whatsappLink(PUBLIC_WHATSAPP_NUMBER, 'Hola, ¿qué diseños tienen disponibles?')}
						class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-gold-light"
					>
						Escríbenos por WhatsApp
					</ExternalLink>
				{/snippet}
			</EmptyState>
		{/snippet}
	</ProductGrid>
</section>

<!-- Collections -->
{#if data.collections.length}
	<section class="mx-auto max-w-7xl px-4 pt-20 md:px-6" aria-labelledby="colecciones">
		<div class="mb-6 flex items-end justify-between gap-4">
			<h2 id="colecciones" class="text-2xl md:text-3xl">Colecciones</h2>
			<a
				href={resolve('/(store)/colecciones')}
				class="inline-flex min-h-11 items-center gap-1 text-sm text-purple-light hover:underline"
			>
				Todas <ArrowRight size={16} stroke-width={1.75} />
			</a>
		</div>
		<ul class="flex flex-wrap gap-3">
			{#each data.collections as collection (collection.id)}
				<li>
					<a
						href={resolve('/(store)/colecciones/[slug]', { slug: collection.slug })}
						class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm transition-colors hover:border-purple-light/60 hover:text-purple-light"
					>
						{collection.nombre}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- Newest -->
{#if data.newest.length}
	<section class="mx-auto max-w-7xl px-4 pt-20 md:px-6">
		<h2 class="mb-6 text-2xl md:text-3xl">Lo más nuevo</h2>
		<ProductGrid products={data.newest} eagerCount={0} />
	</section>
{/if}

<!-- Custom orders CTA -->
<section class="mx-auto max-w-7xl px-4 pt-20 md:px-6">
	<div
		class="relative isolate overflow-hidden rounded-2xl border border-gold/30 bg-surface px-6 py-12 text-center md:px-12 md:py-16"
	>
		<div
			class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-gold)_12%,transparent),transparent_70%)]"
			aria-hidden="true"
		></div>
		<p class="text-xs font-medium tracking-[0.3em] text-gold uppercase">Encargos especiales</p>
		<h2 class="mx-auto mt-3 max-w-2xl text-3xl md:text-4xl">
			¿Tienes una idea? Hagámosla realidad
		</h2>
		<p class="mx-auto mt-3 max-w-xl text-muted-foreground">
			Grabado láser, sublimación, vinil, velas o impresión 3D: cuéntanos qué imaginas y te
			cotizamos.
		</p>
		<a
			href={resolve('/(store)/encargos')}
			class="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light"
		>
			<Sparkles size={16} stroke-width={1.75} />
			Cotizar mi encargo
		</a>
	</div>
</section>
