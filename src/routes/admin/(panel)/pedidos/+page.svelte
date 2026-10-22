<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { BellRing, Search } from '@lucide/svelte';
	import OrderStatusBadge from '#lib/components/admin/OrderStatusBadge.svelte';
	import { formatMoney } from '#lib/domain/money.js';
	import { STATUSES, STATUS_LABELS } from '#lib/domain/order-status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Mexico_City'
	});

	// Ids already shown; not reactive on purpose, it only remembers the previous load.
	let seen: Set<string> | null = null;
	let fresh = $state<string[]>([]);
	// Near real time: refresh every 20 s while the tab is visible (no browser session needed).
	$effect(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('admin:pedidos');
		}, 20_000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		const orders = data.orders;
		untrack(() => {
			if (seen) {
				const added = orders.filter(
					(order) => !seen!.has(order.id) && order.estado === 'pendiente'
				);
				if (added.length) fresh = [...added.map((order) => order.folio), ...fresh].slice(0, 5);
			}
			seen = new Set(orders.map((order) => order.id));
		});
	});

	const isNew = (createdAt: string) => Date.now() - Date.parse(createdAt) < 24 * 60 * 60 * 1000;
	const select =
		'min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground';
</script>

<svelte:head>
	<title>Pedidos · Panel Ouroboros</title>
</svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="font-display text-2xl text-foreground md:text-3xl">Pedidos</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{data.pendientes} pendientes · {data.esperandoAnticipo} esperando anticipo
		</p>
	</div>
</div>

<div aria-live="polite">
	{#if fresh.length}
		<div
			class="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm"
		>
			<BellRing size={18} strokeWidth={1.75} class="text-gold" aria-hidden="true" />
			<span>Nuevo pedido: {fresh.join(', ')}</span>
			<button
				type="button"
				class="ml-auto min-h-11 px-2 text-muted-foreground hover:text-foreground"
				onclick={() => (fresh = [])}
			>
				Entendido
			</button>
		</div>
	{/if}
</div>

<form
	method="GET"
	class="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
	data-sveltekit-keepfocus
>
	<label class="relative block">
		<span class="sr-only">Buscar por folio, nombre o teléfono</span>
		<Search
			size={18}
			strokeWidth={1.75}
			class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			name="q"
			value={data.filters.q}
			placeholder="Folio, nombre o teléfono"
			class="min-h-11 w-full rounded-md border border-border bg-transparent pr-3 pl-10 text-sm text-foreground"
		/>
	</label>
	<label>
		<span class="sr-only">Estado</span>
		<select
			name="estado"
			value={data.filters.estado}
			class={select}
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		>
			<option value="">Todos los estados</option>
			{#each STATUSES as status (status)}
				<option value={status}>{STATUS_LABELS[status]}</option>
			{/each}
		</select>
	</label>
	<label>
		<span class="sr-only">Tipo</span>
		<select
			name="tipo"
			value={data.filters.tipo}
			class={select}
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		>
			<option value="">Catálogo y encargos</option>
			<option value="catalogo">Catálogo</option>
			<option value="encargo">Encargos</option>
		</select>
	</label>
	<button
		type="submit"
		class="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-surface-raised"
	>
		Buscar
	</button>
</form>

{#if data.orders.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		{data.filters.q || data.filters.estado || data.filters.tipo
			? 'Ningún pedido coincide con esa búsqueda.'
			: 'Todavía no hay pedidos. Cuando un cliente haga uno, aparecerá aquí.'}
	</p>
{:else}
	<ul class="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
		{#each data.orders as order (order.id)}
			<li>
				<a
					href={resolve('/admin/(panel)/pedidos/[id]', { id: order.id })}
					class="grid min-h-12 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-raised md:grid-cols-[9rem_1fr_10rem_8rem_8rem]"
				>
					<span class="font-medium text-foreground tabular-nums">
						{order.folio}
						{#if order.estado === 'pendiente' && isNew(order.created_at)}
							<span
								class="ml-1 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
								>NUEVO</span
							>
						{/if}
					</span>
					<span class="justify-self-end md:order-last"
						><OrderStatusBadge estado={order.estado} /></span
					>
					<span class="min-w-0 truncate text-sm text-foreground">
						{order.cliente_nombre}
						<span class="text-muted-foreground">
							· {order.tipo === 'encargo' ? 'Encargo' : 'Catálogo'}</span
						>
					</span>
					<span class="text-xs text-muted-foreground md:text-sm"
						>{dateFormat.format(new Date(order.created_at))}</span
					>
					<span class="text-sm tabular-nums md:text-right">
						{order.total ? formatMoney(order.total) : 'Por cotizar'}
						{#if order.pagado > 0 && order.saldo > 0}
							<span class="block text-xs text-muted-foreground"
								>Saldo {formatMoney(order.saldo)}</span
							>
						{/if}
					</span>
				</a>
			</li>
		{/each}
	</ul>
	{#if data.limited}
		<p class="mt-3 text-xs text-muted-foreground">
			Se muestran los 200 más recientes. Usa la búsqueda para encontrar otros.
		</p>
	{/if}
{/if}
