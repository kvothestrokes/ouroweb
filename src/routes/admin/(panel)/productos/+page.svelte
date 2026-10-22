<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Eye, EyeOff, Plus, Search } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { basePrice } from '#lib/domain/pricing.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let query = $state('');

	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q
			? data.products.filter((product) =>
					`${product.nombre} ${product.categoria}`.toLowerCase().includes(q)
				)
			: data.products;
	});

	function price(product: (typeof data.products)[number]): string {
		const cents = basePrice(
			{ precio_base: product.precioBase },
			{ precio_normal: product.precioPrenda }
		);
		return cents === null ? 'Sin precio' : formatMoney(cents);
	}
</script>

<svelte:head>
	<title>Productos · Panel Ouroboros</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="font-display text-2xl text-foreground md:text-3xl">Productos</h1>
	<Button href={resolve('/admin/(panel)/productos/nuevo')} class="min-h-11">
		<Plus size={18} strokeWidth={1.75} aria-hidden="true" />
		Nuevo producto
	</Button>
</div>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

{#if data.products.length === 0}
	<div
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay productos. Crea el primero: elige un diseño, la prenda y sus colores.
	</div>
{:else}
	<label class="relative mt-6 block max-w-sm">
		<span class="sr-only">Buscar productos</span>
		<Search
			size={18}
			strokeWidth={1.75}
			class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			bind:value={query}
			placeholder="Buscar por nombre o categoría"
			class="min-h-11 w-full rounded-md border border-border bg-transparent pr-3 pl-10 text-sm text-foreground"
		/>
	</label>

	{#if visible.length === 0}
		<p class="mt-6 text-sm text-muted-foreground">Ningún producto coincide con «{query}».</p>
	{:else}
		<ul class="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
			{#each visible as product (product.id)}
				<li class="flex items-center gap-3 p-3">
					<a
						href={resolve('/admin/(panel)/productos/[id]', { id: product.id })}
						class="flex min-w-0 flex-1 items-center gap-3"
					>
						<div class="size-14 shrink-0 overflow-hidden rounded-md bg-surface-raised">
							{#if product.mockup}
								<img
									src="{resolve('/admin/(panel)/disenos/[id]/mockup/[baseId]', {
										id: product.mockup.designId,
										baseId: product.mockup.baseId
									})}?s=400"
									alt=""
									width="56"
									height="56"
									loading="lazy"
									draggable="false"
									class="size-full object-cover"
								/>
							{:else if product.photo}
								<img
									src={product.photo}
									alt=""
									width="56"
									height="56"
									loading="lazy"
									draggable="false"
									class="size-full object-cover"
								/>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p
								class={[
									'truncate font-medium',
									product.activo ? 'text-foreground' : 'text-muted-foreground'
								]}
							>
								{product.nombre}
							</p>
							<p class="truncate text-xs text-muted-foreground">
								{product.categoria} · {product.modoStock === 'stock' ? 'En stock' : 'Bajo pedido'}
								{product.activo ? '' : ' · Oculto'}
							</p>
						</div>
						<span class="shrink-0 text-sm font-semibold text-gold tabular-nums"
							>{price(product)}</span
						>
					</a>
					<form method="POST" action="?/activo" use:enhance>
						<input type="hidden" name="id" value={product.id} />
						<input type="hidden" name="activo" value={String(!product.activo)} />
						<button
							type="submit"
							aria-label={product.activo
								? `Ocultar ${product.nombre}`
								: `Mostrar ${product.nombre}`}
							title={product.activo ? 'Ocultar en la tienda' : 'Mostrar en la tienda'}
							class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
						>
							{#if product.activo}
								<Eye size={18} strokeWidth={1.75} aria-hidden="true" />
							{:else}
								<EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
							{/if}
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
