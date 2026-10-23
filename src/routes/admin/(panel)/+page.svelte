<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	import OrderStatusBadge from '#lib/components/admin/OrderStatusBadge.svelte';
	import { formatMoney } from '#lib/domain/money.js';
	import { STATUSES, STATUS_LABELS } from '#lib/domain/order-status.js';
	import { NAV } from './nav.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sections = NAV.filter((item) => item.path !== '/admin' && item.route);
	const month = new Intl.DateTimeFormat('es-MX', {
		month: 'long',
		timeZone: 'America/Mexico_City'
	}).format(new Date());
	const time = new Intl.DateTimeFormat('es-MX', {
		timeStyle: 'short',
		dateStyle: 'short',
		timeZone: 'America/Mexico_City'
	});
	const open = STATUSES.filter((status) => status !== 'entregado' && status !== 'cancelado');
	const card = 'rounded-xl border border-border bg-card p-5';
</script>

<svelte:head>
	<title>Inicio · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Resumen</h1>

<dl class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
	<div class={card}>
		<dt class="text-sm text-muted-foreground">Nuevos hoy</dt>
		<dd class="mt-1 font-display text-3xl text-foreground tabular-nums">{data.stats.nuevosHoy}</dd>
	</div>
	<div class={card}>
		<dt class="text-sm text-muted-foreground">Cobrado en {month}</dt>
		<dd class="mt-1 font-display text-3xl text-gold tabular-nums">
			{formatMoney(data.stats.ventasMes)}
		</dd>
	</div>
	<div class={card}>
		<dt class="text-sm text-muted-foreground">Pedidos en {month}</dt>
		<dd class="mt-1 font-display text-3xl text-foreground tabular-nums">{data.stats.pedidosMes}</dd>
	</div>
	<div class={card}>
		<dt class="text-sm text-muted-foreground">Anticipos pendientes</dt>
		<dd class="mt-1 font-display text-3xl text-warning tabular-nums">
			{data.stats.anticiposPendientes.pedidos}
		</dd>
		{#if data.stats.anticiposPendientes.monto}
			<dd class="text-xs text-muted-foreground tabular-nums">
				{formatMoney(data.stats.anticiposPendientes.monto)} por recibir
			</dd>
		{/if}
	</div>
</dl>

<div class="mt-6 grid gap-6 lg:grid-cols-2">
	<section class={card} aria-labelledby="por-estado">
		<h2 id="por-estado" class="mb-4 font-display text-lg text-foreground">Pedidos abiertos</h2>
		<ul class="flex flex-col">
			{#each open as status (status)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()d path plus the status filter -->
					<a
						href={`${resolve('/admin/(panel)/pedidos')}?estado=${status}`}
						class="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 hover:bg-surface-raised"
					>
						<OrderStatusBadge estado={status} />
						<span
							class="tabular-nums {data.stats.porEstado[status]
								? 'text-foreground'
								: 'text-muted-foreground'}"
						>
							{data.stats.porEstado[status]}
						</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-xs text-muted-foreground">
			{STATUS_LABELS.entregado}: {data.stats.porEstado.entregado} · {STATUS_LABELS.cancelado}: {data
				.stats.porEstado.cancelado}
		</p>
	</section>

	<section class={card} aria-labelledby="pendientes">
		<div class="mb-4 flex items-center justify-between gap-3">
			<h2 id="pendientes" class="font-display text-lg text-foreground">Por atender</h2>
			<a
				href={resolve('/admin/(panel)/pedidos')}
				class="inline-flex min-h-11 items-center gap-1 text-sm text-purple-light hover:underline"
			>
				Todos <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
			</a>
		</div>
		{#if data.recientes.length}
			<ul class="divide-y divide-border">
				{#each data.recientes as order (order.id)}
					<li>
						<a
							href={resolve('/admin/(panel)/pedidos/[id]', { id: order.id })}
							class="flex min-h-12 items-center justify-between gap-3 px-2 py-2 hover:bg-surface-raised"
						>
							<span>
								<span class="font-medium tabular-nums">{order.folio}</span>
								<span class="block text-xs text-muted-foreground"
									>{order.cliente_nombre} · {time.format(new Date(order.created_at))}</span
								>
							</span>
							<span class="text-sm tabular-nums"
								>{order.total ? formatMoney(order.total) : 'Por cotizar'}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">No hay pedidos pendientes. 🎉</p>
		{/if}
	</section>
</div>

<h2 class="mt-10 mb-4 font-display text-lg text-foreground">Accesos</h2>
<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
	{#each sections as item (item.path)}
		{#if item.route}
			<li>
				<a
					href={resolve(item.route)}
					class="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 transition-colors hover:bg-surface-raised"
				>
					<item.icon size={20} strokeWidth={1.75} class="text-gold" />
					<span class="text-sm font-medium text-foreground">{item.label}</span>
				</a>
			</li>
		{/if}
	{/each}
</ul>
