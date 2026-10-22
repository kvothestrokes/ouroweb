<script lang="ts">
	import { resolve } from '$app/paths';
	import Minus from '@lucide/svelte/icons/minus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import OrderSummary from '#lib/components/store/OrderSummary.svelte';
	import ProtectedImage from '#lib/components/store/ProtectedImage.svelte';
	import { cartQuote, cartRows } from '#lib/client/cart-view.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { MAX_QUANTITY, cart } from '#lib/stores/cart.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let ready = $state(false);
	$effect(() => {
		cart.load();
		ready = true;
	});

	const rows = $derived(cartRows(cart.lines, data.products));
	const quote = $derived(cartQuote(cart.lines, data.products));
	const hasProblems = $derived(rows.some((row) => row.problem));
	const hasCustomization = $derived(cart.lines.some((line) => line.personalizacion));
</script>

<svelte:head>
	<title>Tu carrito — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
	<h1 class="mb-8 text-3xl md:text-4xl">Tu carrito</h1>

	{#if !ready}
		<div class="flex flex-col gap-4" aria-hidden="true">
			{#each { length: 2 }, i (i)}
				<div class="h-32 animate-pulse rounded-xl bg-surface-raised"></div>
			{/each}
		</div>
	{:else if !rows.length}
		<EmptyState title="Tu carrito está vacío">
			Explora la tienda y agrega tus diseños favoritos.
			{#snippet action()}
				<a
					href={resolve('/(store)')}
					class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-gold-light"
				>
					Ir a la tienda
				</a>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
			<ul class="flex flex-col divide-y divide-border">
				{#each rows as row (row.key)}
					<li class="flex gap-4 py-5 first:pt-0">
						<a
							href={resolve('/(store)/p/[producto]', { producto: row.line.slug })}
							class="w-24 shrink-0 overflow-hidden rounded-lg sm:w-28"
							aria-hidden="true"
							tabindex="-1"
						>
							{#if row.image}
								<ProtectedImage image={row.image} alt="" sizes="112px" class="aspect-[4/5]" />
							{:else}
								<div class="aspect-[4/5] product-stage"></div>
							{/if}
						</a>
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<div class="flex items-start justify-between gap-3">
								<a
									href={resolve('/(store)/p/[producto]', { producto: row.line.slug })}
									class="line-clamp-2 text-sm font-medium hover:text-gold-light"
								>
									{row.product?.nombre ?? 'Producto no disponible'}
								</a>
								<button
									type="button"
									onclick={() => cart.remove(row.key)}
									aria-label="Quitar {row.product?.nombre ?? 'producto'} del carrito"
									class="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-danger"
								>
									<Trash2 size={18} stroke-width={1.75} />
								</button>
							</div>
							<p class="text-xs text-muted-foreground">
								{[row.colorName, row.line.talla && `Talla ${row.line.talla}`]
									.filter(Boolean)
									.join(' · ')}
							</p>
							{#if row.line.personalizacion}
								<p class="text-xs text-purple-light">
									<Pencil size={14} stroke-width={1.75} class="mr-1 inline" aria-hidden="true" />
									{row.line.personalizacion}
									<span class="text-muted-foreground">(por cotizar)</span>
								</p>
							{/if}
							{#if row.problem}
								<p class="text-xs text-danger">{row.problem}</p>
							{/if}
							<div class="mt-auto flex items-center justify-between gap-3 pt-2">
								<div
									class="flex items-center rounded-full border border-border"
									role="group"
									aria-label="Cantidad"
								>
									<button
										type="button"
										aria-label="Quitar una pieza"
										disabled={row.line.cantidad <= 1}
										onclick={() => cart.setQuantity(row.key, row.line.cantidad - 1)}
										class="grid size-11 place-items-center rounded-full hover:bg-surface-raised disabled:opacity-40"
									>
										<Minus size={16} stroke-width={1.75} />
									</button>
									<span class="w-8 text-center text-sm tabular-nums" aria-live="polite">
										{row.line.cantidad}
									</span>
									<button
										type="button"
										aria-label="Agregar una pieza"
										disabled={row.line.cantidad >= MAX_QUANTITY}
										onclick={() => cart.setQuantity(row.key, row.line.cantidad + 1)}
										class="grid size-11 place-items-center rounded-full hover:bg-surface-raised disabled:opacity-40"
									>
										<Plus size={16} stroke-width={1.75} />
									</button>
								</div>
								{#if row.unitPrice !== null}
									<p class="text-right">
										<span class="block font-semibold text-gold tabular-nums">
											{formatMoney(row.unitPrice * row.line.cantidad)}
										</span>
										{#if row.line.cantidad > 1}
											<span class="text-xs text-muted-foreground tabular-nums">
												{formatMoney(row.unitPrice)} c/u
											</span>
										{/if}
									</p>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<div class="lg:sticky lg:top-24">
				<OrderSummary
					subtotal={quote.ok ? quote.value.subtotal : 0}
					descMayoreo={quote.ok ? quote.value.descMayoreo : 0}
					envio={null}
					personalizacion={hasCustomization}
				>
					{#if !quote.ok && !hasProblems}
						<p class="text-sm text-danger" role="alert">{quote.message}</p>
					{/if}
					{#if hasProblems}
						<p class="text-sm text-danger">Quita o ajusta los productos marcados para continuar.</p>
					{/if}
					{#if quote.ok}
						<a
							href={resolve('/(store)/checkout')}
							class="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light"
						>
							Continuar con mi pedido
						</a>
					{/if}
					<a
						href={resolve('/(store)')}
						class="inline-flex min-h-11 items-center justify-center text-sm text-purple-light hover:underline"
					>
						Seguir comprando
					</a>
				</OrderSummary>
			</div>
		</div>
	{/if}
</div>
