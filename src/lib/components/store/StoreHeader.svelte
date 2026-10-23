<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Heart from '@lucide/svelte/icons/heart';
	import House from '@lucide/svelte/icons/house';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Menu from '@lucide/svelte/icons/menu';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { cart } from '#lib/stores/cart.svelte.js';
	import { favorites } from '#lib/stores/favorites.svelte.js';
	import { cn } from '#lib/utils.js';
	import ThemeToggle from '../ThemeToggle.svelte';
	import Panel from './Panel.svelte';
	import type { StoreCategoryTree } from '#lib/domain/store-product.js';

	type Props = { categories: StoreCategoryTree };

	let { categories }: Props = $props();

	let menuOpen = $state(false);

	$effect(() => {
		favorites.load();
		cart.load();
	});

	/** Root category the current page belongs to, to highlight it. */
	const activeRoot = $derived.by(() => {
		const slug = page.params.categoria;
		if (!slug) return null;
		return (
			categories.find((root) => root.slug === slug || root.children.some((c) => c.slug === slug))
				?.slug ?? null
		);
	});

	// The product page has its own fixed buy bar at the bottom.
	const showTabBar = $derived(page.route.id !== '/(store)/p/[producto]');
	const isHome = $derived(page.route.id === '/(store)');

	const iconButton =
		'relative grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-raised';
</script>

<div
	class="flex h-9 items-center justify-center gap-6 bg-primary px-4 text-[11px] font-medium tracking-[0.12em] text-primary-foreground uppercase"
>
	<span>Pedidos por WhatsApp</span>
	<span class="hidden text-gold-fill sm:inline" aria-hidden="true">✦</span>
	<span class="hidden sm:inline">Personalizamos tu diseño</span>
	<span class="hidden text-gold-fill md:inline" aria-hidden="true">✦</span>
	<span class="hidden md:inline">Envíos a todo México</span>
</div>

<header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-7xl items-center gap-2 px-2 md:gap-4 md:px-6">
		<button
			type="button"
			class={cn(iconButton, 'lg:hidden')}
			aria-label="Abrir menú"
			onclick={() => (menuOpen = true)}
		>
			<Menu size={20} stroke-width={1.75} />
		</button>

		<a
			href={resolve('/(store)')}
			class="flex shrink-0 items-center gap-2 px-1"
			aria-label="Ouroboros, inicio"
		>
			<img
				src="/brand/ourologo.webp"
				alt=""
				width="36"
				height="36"
				class="size-9 rounded-full object-cover"
			/>
			<span
				class="hidden font-display text-xl font-bold tracking-[0.08em] text-gold uppercase sm:inline"
				>Ouroboros</span
			>
		</a>

		<nav aria-label="Categorías" class="hidden flex-1 justify-center lg:flex">
			<ul class="flex items-center gap-1">
				{#each categories as root (root.id)}
					<li>
						<a
							href={resolve('/(store)/c/[categoria]', { categoria: root.slug })}
							aria-current={activeRoot === root.slug ? 'page' : undefined}
							class={cn(
								'inline-flex min-h-11 items-center rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
								activeRoot === root.slug
									? 'text-gold'
									: 'text-muted-foreground hover:text-foreground'
							)}
						>
							{root.nombre}
						</a>
					</li>
				{/each}
				<li>
					<a
						href={resolve('/(store)/colecciones')}
						aria-current={page.route.id?.startsWith('/(store)/colecciones') ? 'page' : undefined}
						class={cn(
							'inline-flex min-h-11 items-center rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
							page.route.id?.startsWith('/(store)/colecciones')
								? 'text-gold'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						Colecciones
					</a>
				</li>
			</ul>
		</nav>

		<div class="ml-auto flex items-center gap-1">
			<form action="/buscar" method="GET" role="search" class="relative hidden 2xl:block">
				<label for="header-search" class="sr-only">Buscar productos</label>
				<Search
					size={16}
					stroke-width={1.75}
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					id="header-search"
					name="q"
					type="search"
					placeholder="Buscar"
					value={page.url.pathname === '/buscar' ? (page.url.searchParams.get('q') ?? '') : ''}
					class="h-11 w-56 rounded-full border border-transparent bg-surface-raised pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-light"
				/>
			</form>
			<a
				href={resolve('/(store)/buscar')}
				class={cn(iconButton, '2xl:hidden')}
				aria-label="Buscar productos"
			>
				<Search size={20} stroke-width={1.75} />
			</a>
			<ThemeToggle />
			<a
				href={resolve('/(store)/favoritos')}
				class={cn(iconButton, 'hidden sm:grid')}
				aria-label="Favoritos{favorites.slugs.length ? ` (${favorites.slugs.length})` : ''}"
			>
				<Heart size={20} stroke-width={1.75} />
				{#if favorites.slugs.length}
					<span
						class="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-gold-fill px-1 text-[10px] leading-4 font-semibold text-on-gold tabular-nums"
						aria-hidden="true"
					>
						{favorites.slugs.length}
					</span>
				{/if}
			</a>
			<a
				href={resolve('/(store)/encargos')}
				class="hidden min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground xl:inline-flex"
			>
				<Sparkles size={16} stroke-width={1.75} class="text-gold" />
				Encargos
			</a>
			<a
				href={resolve('/(store)/carrito')}
				class="relative ml-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:px-4"
				aria-label="Carrito{cart.count ? ` (${cart.count})` : ''}"
			>
				<ShoppingBag size={18} stroke-width={1.75} />
				<span class="hidden sm:inline">Carrito</span>
				{#if cart.count}
					<span
						class="grid min-w-5 place-items-center rounded-full bg-gold-fill px-1 text-[11px] leading-5 font-bold text-on-gold tabular-nums"
						aria-hidden="true"
					>
						{cart.count > 99 ? '99+' : cart.count}
					</span>
				{/if}
			</a>
		</div>
	</div>
</header>

<Panel bind:open={menuOpen} title="Menú" side="left">
	<nav aria-label="Categorías">
		<ul class="flex flex-col gap-3">
			{#each categories as root (root.id)}
				<li>
					<a
						href={resolve('/(store)/c/[categoria]', { categoria: root.slug })}
						onclick={() => (menuOpen = false)}
						class="flex min-h-11 items-center font-display text-base text-foreground hover:text-gold"
					>
						{root.nombre}
					</a>
					{#if root.children.length}
						<ul class="mt-1 flex flex-col">
							{#each root.children as child (child.id)}
								<li>
									<a
										href={resolve('/(store)/c/[categoria]', { categoria: child.slug })}
										onclick={() => (menuOpen = false)}
										class="flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
									>
										{child.nombre}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
			<li>
				<a
					href={resolve('/(store)/colecciones')}
					onclick={() => (menuOpen = false)}
					class="flex min-h-11 items-center font-display text-base text-foreground hover:text-gold"
				>
					Colecciones
				</a>
			</li>
		</ul>
	</nav>
	{#snippet footer()}
		<a
			href={resolve('/(store)/encargos')}
			onclick={() => (menuOpen = false)}
			class="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
		>
			<Sparkles size={16} stroke-width={1.75} />
			Encargos especiales
		</a>
	{/snippet}
</Panel>

{#if showTabBar}
	<nav
		aria-label="Navegación principal"
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
	>
		<a
			href={resolve('/(store)')}
			aria-current={isHome ? 'page' : undefined}
			class={cn(
				'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
				isHome ? 'text-gold' : 'text-muted-foreground'
			)}
		>
			<House size={22} stroke-width={1.75} />
			Inicio
		</a>
		<button
			type="button"
			onclick={() => (menuOpen = true)}
			class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
		>
			<LayoutGrid size={22} stroke-width={1.75} />
			Categorías
		</button>
		<a
			href={resolve('/(store)/favoritos')}
			class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
		>
			<Heart size={22} stroke-width={1.75} />
			Favoritos
			{#if favorites.slugs.length}
				<span
					class="absolute top-1.5 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-gold-fill px-1 text-[10px] leading-4 font-bold text-on-gold"
					aria-hidden="true">{favorites.slugs.length}</span
				>
			{/if}
		</a>
		<a
			href={resolve('/(store)/encargos')}
			class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
		>
			<Sparkles size={22} stroke-width={1.75} />
			Encargos
		</a>
	</nav>
{/if}
