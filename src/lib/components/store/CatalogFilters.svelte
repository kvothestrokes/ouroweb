<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import {
		SORT_OPTIONS,
		hasActiveFilters,
		type CatalogFilters
	} from '#lib/domain/catalog-filters.js';
	import type { Facets, StoreCollection } from '#lib/domain/store-product.js';
	import { cn } from '#lib/utils.js';
	import Panel from './Panel.svelte';

	type Props = {
		filters: CatalogFilters;
		facets: Facets;
		collections: StoreCollection[];
		total: number;
		/** Hides the collection filter (collection pages). */
		hideCollection?: boolean;
		/** The results, shown next to the desktop sidebar. */
		children: Snippet;
	};

	let { filters, facets, collections, total, hideCollection = false, children }: Props = $props();

	let panelOpen = $state(false);

	const collectionOptions = $derived(
		collections.filter((collection) => facets.colecciones.includes(collection.slug))
	);
	const activeCount = $derived(
		filters.colores.length +
			filters.tallas.length +
			(filters.min !== null || filters.max !== null ? 1 : 0) +
			(filters.coleccion ? 1 : 0) +
			(filters.soloStock ? 1 : 0)
	);
	const clearHref = $derived(
		filters.q ? `${page.url.pathname}?q=${encodeURIComponent(filters.q)}` : page.url.pathname
	);

	/** Desktop applies right away; the mobile panel waits for "Ver resultados". */
	function autoSubmit(event: Event) {
		const form = (event.currentTarget as HTMLElement).closest('form');
		if (form?.dataset.auto === 'true') form.requestSubmit();
	}

	/** Keeps shareable URLs short: no empty fields and no default order. */
	function dropEmpty(event: FormDataEvent) {
		const entries = [...event.formData];
		for (const [key] of entries) event.formData.delete(key);
		for (const [key, value] of entries) {
			if (value !== '' && !(key === 'orden' && value === 'nuevos'))
				event.formData.append(key, value);
		}
	}

	const pesos = (cents: number | null) => (cents === null ? '' : String(cents / 100));
	const chip =
		'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-sm transition-colors has-checked:border-transparent has-checked:bg-accent has-checked:text-accent-foreground hover:border-purple-light/50 has-focus-visible:outline-2 has-focus-visible:outline-ring';
</script>

{#snippet fields(auto: boolean)}
	{#if filters.q}<input type="hidden" name="q" value={filters.q} />{/if}
	<input type="hidden" name="orden" value={filters.orden} />

	<div class="flex flex-col gap-7">
		<label class="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
			<span>Solo en stock</span>
			<input
				type="checkbox"
				name="stock"
				value="1"
				checked={filters.soloStock}
				onchange={auto ? autoSubmit : undefined}
				class="peer sr-only"
			/>
			<span
				class="relative h-6 w-11 rounded-full bg-surface-raised transition-colors peer-checked:bg-gold peer-focus-visible:outline-2 peer-focus-visible:outline-ring after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-foreground after:transition-transform peer-checked:after:translate-x-5"
				aria-hidden="true"
			></span>
		</label>

		{#if facets.colores.length}
			<fieldset>
				<legend class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
					Color
				</legend>
				<div class="flex flex-wrap gap-2">
					{#each facets.colores as color (color.key)}
						<label class={chip}>
							<input
								type="checkbox"
								name="color"
								value={color.key}
								checked={filters.colores.includes(color.key)}
								onchange={auto ? autoSubmit : undefined}
								class="sr-only"
							/>
							<span
								class="size-4 rounded-full border border-border"
								style:background-color={color.hex}
							></span>
							{color.nombre}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if facets.tallas.length}
			<fieldset>
				<legend class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
					Talla
				</legend>
				<div class="flex flex-wrap gap-2">
					{#each facets.tallas as size (size)}
						<label class={cn(chip, 'min-w-11 justify-center')}>
							<input
								type="checkbox"
								name="talla"
								value={size}
								checked={filters.tallas.includes(size)}
								onchange={auto ? autoSubmit : undefined}
								class="sr-only"
							/>
							{size}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<fieldset>
			<legend class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
				Precio (MXN)
			</legend>
			<div class="flex items-center gap-2">
				<label class="sr-only" for="min-{auto}">Precio mínimo</label>
				<input
					id="min-{auto}"
					name="min"
					inputmode="numeric"
					pattern="[0-9]*"
					placeholder="Mín."
					value={pesos(filters.min)}
					onchange={auto ? autoSubmit : undefined}
					class="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm tabular-nums focus:border-purple-light"
				/>
				<span class="text-muted-foreground" aria-hidden="true">–</span>
				<label class="sr-only" for="max-{auto}">Precio máximo</label>
				<input
					id="max-{auto}"
					name="max"
					inputmode="numeric"
					pattern="[0-9]*"
					placeholder="Máx."
					value={pesos(filters.max)}
					onchange={auto ? autoSubmit : undefined}
					class="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm tabular-nums focus:border-purple-light"
				/>
			</div>
		</fieldset>

		{#if !hideCollection && collectionOptions.length}
			<fieldset>
				<legend class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
					Fandom
				</legend>
				<div class="flex flex-wrap gap-2">
					<label class={chip}>
						<input
							type="radio"
							name="coleccion"
							value=""
							checked={!filters.coleccion}
							onchange={auto ? autoSubmit : undefined}
							class="sr-only"
						/>
						Todos
					</label>
					{#each collectionOptions as collection (collection.slug)}
						<label class={chip}>
							<input
								type="radio"
								name="coleccion"
								value={collection.slug}
								checked={filters.coleccion === collection.slug}
								onchange={auto ? autoSubmit : undefined}
								class="sr-only"
							/>
							{collection.nombre}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
	</div>
{/snippet}

<div class="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
	<aside class="hidden lg:block" aria-label="Filtros">
		<h2 class="mb-6 font-display text-lg">Filtros</h2>
		<form
			method="GET"
			onformdata={dropEmpty}
			data-auto="true"
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
		>
			{@render fields(true)}
			<noscript>
				<button
					type="submit"
					class="mt-6 min-h-11 w-full rounded-full bg-primary text-primary-foreground"
				>
					Aplicar
				</button>
			</noscript>
			{#if hasActiveFilters({ ...filters, q: '' })}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page without filters -->
				<a
					href={clearHref}
					class="mt-6 inline-flex min-h-11 items-center text-sm text-purple-light hover:underline"
				>
					Quitar filtros
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</form>
	</aside>

	<div class="flex min-w-0 flex-col gap-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-muted-foreground" aria-live="polite">
				{total}
				{total === 1 ? 'producto' : 'productos'}
			</p>
			<div class="flex min-w-0 items-center gap-2">
				<button
					type="button"
					onclick={() => (panelOpen = true)}
					class="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-surface-raised lg:hidden"
				>
					<SlidersHorizontal size={16} stroke-width={1.75} />
					Filtros
					{#if activeCount}
						<span
							class="grid min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-semibold text-primary-foreground"
						>
							{activeCount}
						</span>
					{/if}
				</button>
				<form method="GET" onformdata={dropEmpty} data-sveltekit-noscroll data-sveltekit-keepfocus>
					{#each page.url.searchParams
						.entries()
						.filter(([key]) => key !== 'orden') as [key, value], i (i)}
						<input type="hidden" name={key} {value} />
					{/each}
					<label for="orden" class="sr-only">Ordenar por</label>
					<select
						id="orden"
						name="orden"
						value={filters.orden}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
						class="h-11 max-w-44 min-w-0 rounded-full border border-border bg-surface px-4 text-sm text-foreground focus:border-purple-light"
					>
						{#each SORT_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</form>
			</div>
		</div>

		{@render children()}
	</div>
</div>

<Panel bind:open={panelOpen} title="Filtros" side="right">
	<form
		id="filters-mobile"
		method="GET"
		onformdata={dropEmpty}
		onsubmit={() => (panelOpen = false)}
		data-sveltekit-noscroll
	>
		{@render fields(false)}
	</form>
	{#snippet footer()}
		<div class="flex items-center gap-3">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page without filters -->
			<a
				href={clearHref}
				onclick={() => (panelOpen = false)}
				class="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border text-sm hover:bg-surface-raised"
			>
				Limpiar
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<button
				type="submit"
				form="filters-mobile"
				class="min-h-11 flex-1 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-gold-light"
			>
				Ver resultados
			</button>
		</div>
	{/snippet}
</Panel>
