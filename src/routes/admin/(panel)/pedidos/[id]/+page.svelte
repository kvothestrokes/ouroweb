<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		Check,
		Copy,
		ImagePlus,
		Link2,
		MessageCircle,
		PackagePlus,
		Pencil,
		Plus,
		RotateCcw,
		Send,
		Sparkles,
		Trash2,
		X
	} from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import OrderStatusBadge from '#lib/components/admin/OrderStatusBadge.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { DELIVERY_METHODS, deliveryLabel, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { centsToInput, formatMoney, parseMoney } from '#lib/domain/money.js';
	import { PAYMENT_METHODS, PAYMENT_TYPES, type PaymentType } from '#lib/domain/order-admin.js';
	import { inferPaymentType } from '#lib/domain/order-money.js';
	import { STATUS_LABELS } from '#lib/domain/order-status.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type EditableLine = {
		key: string;
		product_id: string | null;
		nombre_snapshot: string;
		color: string;
		talla: string;
		cantidad: number;
		precio_pesos: string;
		recargo_pesos: string;
		personalizacion_texto: string;
	};

	const order = $derived(data.order);
	let busy = $state(false);
	let fileName = $state<string | null>(null);
	let copiedKey = $state<string | null>(null);

	// Toggleable edit modes
	let editingItems = $state(false);
	let editingRequest = $state(false);
	let editingCustomer = $state(false);

	// Editable items state
	let selectedProductId = $state('');
	let draftLines = $state<EditableLine[]>([]);
	let draftMayoreoPesos = $state('0');

	// Editable customer state
	let editMetodoEntrega = $state<DeliveryMethod>('recoger');

	// Quote & Payment quick-fill state
	let quoteAnticipoInput = $state('');
	let quoteAnticipoManual = $state(false);

	let paymentTipo = $state<PaymentType>('anticipo');
	let paymentMonto = $state('');
	let paymentMetodo = $state('Transferencia');
	let paymentMetodoOtro = $state('');
	let paymentTipoManual = $state(false);
	let showCustomFecha = $state(false);
	let paymentFecha = $state('');

	$effect(() => {
		if (!quoteAnticipoManual) {
			quoteAnticipoInput = centsToInput(order.anticipo_requerido ?? data.suggestedDeposit);
		}
	});

	function updatePaymentTypeForAmount(montoInput: string) {
		paymentMonto = montoInput;
		if (!paymentTipoManual) {
			const cents = parseMoney(montoInput) ?? 0;
			paymentTipo = inferPaymentType({
				monto: cents,
				saldo: data.balance.saldo,
				pagado: data.balance.pagado,
				anticipoRequerido: order.anticipo_requerido,
				hasAnticipo: order.payments.some((p) => p.tipo === 'anticipo')
			});
		}
	}

	function openItemsEditor() {
		draftLines = order.order_items.map((item) => ({
			key: item.id,
			product_id: item.product_id ?? null,
			nombre_snapshot: item.nombre_snapshot,
			color: item.color ?? '',
			talla: item.talla ?? '',
			cantidad: item.cantidad,
			precio_pesos: centsToInput(item.precio_unitario),
			recargo_pesos: centsToInput(item.recargo_talla) || '0',
			personalizacion_texto: item.personalizacion_texto ?? ''
		}));
		draftMayoreoPesos = centsToInput(order.desc_mayoreo) || '0';
		editingItems = true;
	}

	function openCustomerEditor() {
		editMetodoEntrega = order.metodo_entrega;
		editingCustomer = true;
	}

	function catalogProductById(id: string | null) {
		if (!id) return null;
		return data.catalogProducts.find((p) => p.id === id) ?? null;
	}

	function addCatalogLine() {
		const prod = catalogProductById(selectedProductId);
		if (!prod) return;
		const defaultSize = prod.tallas[0] ?? '';
		const defaultSurcharge = defaultSize ? (prod.recargos[defaultSize] ?? 0) : 0;
		draftLines = [
			...draftLines,
			{
				key: crypto.randomUUID(),
				product_id: prod.id,
				nombre_snapshot: prod.nombre,
				color: prod.colores[0] ?? '',
				talla: defaultSize,
				cantidad: 1,
				precio_pesos: centsToInput(prod.precio_unitario),
				recargo_pesos: centsToInput(defaultSurcharge) || '0',
				personalizacion_texto: ''
			}
		];
		selectedProductId = '';
	}

	function addFreeLine() {
		draftLines = [
			...draftLines,
			{
				key: crypto.randomUUID(),
				product_id: null,
				nombre_snapshot: '',
				color: '',
				talla: '',
				cantidad: 1,
				precio_pesos: '',
				recargo_pesos: '0',
				personalizacion_texto: ''
			}
		];
	}

	function removeDraftLine(key: string) {
		if (draftLines.length <= 1) return;
		draftLines = draftLines.filter((line) => line.key !== key);
	}

	function onDraftSizeChange(line: EditableLine, newSize: string) {
		line.talla = newSize;
		const prod = catalogProductById(line.product_id);
		if (prod && newSize in prod.recargos) {
			line.recargo_pesos = centsToInput(prod.recargos[newSize] ?? 0) || '0';
		}
	}

	const toCentsSafe = (val: string): number => {
		const parsed = parseMoney(val);
		return parsed === null || Number.isNaN(parsed) ? 0 : parsed;
	};

	const draftSubtotalCents = $derived(
		draftLines.reduce((sum, line) => {
			const unit = toCentsSafe(line.precio_pesos);
			const sur = toCentsSafe(line.recargo_pesos);
			const qty = Math.max(1, Number(line.cantidad) || 1);
			return sum + (unit + sur) * qty;
		}, 0)
	);

	const draftItemsJson = $derived(
		JSON.stringify(
			draftLines.map((line) => ({
				product_id: line.product_id,
				nombre_snapshot: line.nombre_snapshot,
				color: line.color || null,
				talla: line.talla || null,
				cantidad: Number(line.cantidad) || 1,
				precio_pesos: line.precio_pesos,
				recargo_pesos: line.recargo_pesos || '0',
				personalizacion_texto: line.personalizacion_texto || null
			}))
		)
	);

	async function copyText(key: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			setTimeout(() => {
				if (copiedKey === key) copiedKey = null;
			}, 2000);
		} catch {
			// Ignore clipboard failures in restricted contexts
		}
	}

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update, result }) => {
			await update();
			busy = false;
			if (result.type === 'success') {
				fileName = null;
				editingItems = false;
				editingRequest = false;
				editingCustomer = false;
			}
		};
	};

	const dateTime = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Mexico_City'
	});
	const date = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' });
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
		new Date()
	);
	const closed = $derived(order.estado === 'entregado' || order.estado === 'cancelado');
	const address = $derived(
		order.direccion && typeof order.direccion === 'object' && !Array.isArray(order.direccion)
			? (order.direccion as Record<string, string>)
			: null
	);
	const last4Digits = $derived(order.cliente_whatsapp.slice(-4));
	const card = 'rounded-xl border border-border bg-card p-5';
	const heading = 'font-display text-lg text-foreground';
	const selectClass =
		'min-h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground';
</script>

<svelte:head>
	<title>{order.folio} · Pedidos · Panel Ouroboros</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-2">
	<a
		href={resolve('/admin/(panel)/pedidos')}
		class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" /> Pedidos
	</a>
	<a
		href={resolve('/admin/(panel)/pedidos/nuevo')}
		class="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
	>
		<Plus size={15} strokeWidth={1.75} aria-hidden="true" /> Nuevo pedido manual
	</a>
</div>

<div class="mt-2 flex flex-wrap items-center gap-3">
	<h1 class="font-display text-2xl text-foreground tabular-nums md:text-3xl">{order.folio}</h1>
	<OrderStatusBadge estado={order.estado} />
	<span class="text-sm text-muted-foreground">
		{order.tipo === 'encargo' ? 'Encargo especial' : 'Catálogo'} · {dateTime.format(
			new Date(order.created_at)
		)}
	</span>
</div>

<!-- Acciones de WhatsApp y barra de copiado rápido (QoL) -->
<div class="mt-4 flex flex-wrap items-center gap-2">
	{#if data.notify}
		<ExternalLink
			href={data.notify.href}
			class="inline-flex min-h-11 items-center gap-2 rounded-md border border-success/50 bg-success/10 px-4 text-sm text-success hover:bg-success/20"
		>
			<Send size={18} strokeWidth={1.75} aria-hidden="true" />
			Avisar por WhatsApp: {data.notify.nombre}
		</ExternalLink>
	{/if}
	<ExternalLink
		href={data.chatHref}
		class="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-surface-raised"
	>
		<MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
		Abrir chat
	</ExternalLink>

	<button
		type="button"
		class="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
		onclick={() => copyText('folio', order.folio)}
	>
		{#if copiedKey === 'folio'}
			<Check size={15} strokeWidth={1.75} class="text-success" aria-hidden="true" />
			Folio copiado
		{:else}
			<Copy size={15} strokeWidth={1.75} aria-hidden="true" />
			Copiar folio
		{/if}
	</button>

	<button
		type="button"
		class="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
		onclick={() =>
			copyText(
				'tracking',
				`Sigue tu pedido ${order.folio} en ${data.trackingUrl} (últimos 4 dígitos de tu WhatsApp: ${last4Digits})`
			)}
	>
		{#if copiedKey === 'tracking'}
			<Check size={15} strokeWidth={1.75} class="text-success" aria-hidden="true" />
			Enlace copiado
		{:else}
			<Link2 size={15} strokeWidth={1.75} aria-hidden="true" />
			Copiar seguimiento
		{/if}
	</button>

	{#if data.whatsappSummary}
		<button
			type="button"
			class="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
			onclick={() =>
				copyText(
					'summary',
					`Pedido *${order.folio}* (${order.cliente_nombre})\n${data.whatsappSummary}\nTotal: ${formatMoney(order.total)} · Saldo: ${formatMoney(data.balance.saldo)}`
				)}
		>
			{#if copiedKey === 'summary'}
				<Check size={15} strokeWidth={1.75} class="text-success" aria-hidden="true" />
				Resumen copiado
			{:else}
				<Copy size={15} strokeWidth={1.75} aria-hidden="true" />
				Copiar resumen
			{/if}
		</button>
	{/if}
</div>

<!-- Floating on phones so the result of a form at the bottom is visible. -->
<div class="fixed inset-x-4 bottom-4 z-40 lg:static lg:inset-auto" aria-live="polite">
	<FormMessage
		error={form?.message}
		success={form?.success}
		class="mt-4 shadow-lg lg:shadow-none"
	/>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
	<div class="flex flex-col gap-6">
		<!-- What was ordered (View & Edit modes) -->
		<section class={card}>
			{#if data.request}
				<div class="mb-4 flex items-center justify-between gap-2">
					<h2 class={heading}>Encargo</h2>
					{#if !closed}
						<button
							type="button"
							class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
							onclick={() => (editingRequest = !editingRequest)}
						>
							{#if editingRequest}
								<X size={14} strokeWidth={1.75} aria-hidden="true" /> Cancelar
							{:else}
								<Pencil size={14} strokeWidth={1.75} aria-hidden="true" /> Editar encargo
							{/if}
						</button>
					{/if}
				</div>

				{#if editingRequest && !closed}
					<form
						method="POST"
						action="?/encargo"
						use:enhance={submit}
						class="grid gap-4 sm:grid-cols-2"
					>
						<div class="flex flex-col gap-2">
							<Label for="edit-req-type">Tipo de encargo</Label>
							<select
								id="edit-req-type"
								name="custom_request_type_id"
								value={data.request.custom_request_type_id ?? ''}
								class={selectClass}
							>
								<option value="">Otro / General</option>
								{#each data.requestTypes as rt (rt.id)}
									<option value={rt.id}>{rt.nombre}</option>
								{/each}
							</select>
						</div>

						<div class="flex flex-col gap-2">
							<Label for="edit-req-qty">Cantidad de piezas</Label>
							<Input
								id="edit-req-qty"
								name="cantidad"
								type="number"
								min="1"
								max="999"
								value={data.request.cantidad}
								required
								class="min-h-11 tabular-nums"
							/>
						</div>

						<div class="flex flex-col gap-2">
							<Label for="edit-req-product">Producto / Prenda (opcional)</Label>
							<Input
								id="edit-req-product"
								name="tipo_producto"
								value={data.request.tipo_producto ?? ''}
								placeholder="Ej. Playera, Sudadera, Termo..."
								class="min-h-11"
							/>
						</div>

						<div class="flex flex-col gap-2">
							<Label for="edit-req-color">Color (opcional)</Label>
							<Input
								id="edit-req-color"
								name="color"
								value={data.request.color ?? ''}
								placeholder="Ej. Negro, Blanco..."
								class="min-h-11"
							/>
						</div>

						<input
							type="hidden"
							name="desglose_tallas"
							value={JSON.stringify(data.request.desglose_tallas ?? [])}
						/>

						<div class="flex flex-col gap-2 sm:col-span-2">
							<Label for="edit-req-date">Fecha deseada (opcional)</Label>
							<Input
								id="edit-req-date"
								name="fecha_deseada"
								type="date"
								value={data.request.fecha_deseada ?? ''}
								class="min-h-11 [color-scheme:dark]"
							/>
						</div>

						<div class="flex flex-col gap-2 sm:col-span-2">
							<Label for="edit-req-desc">Descripción del encargo</Label>
							<textarea
								id="edit-req-desc"
								name="descripcion"
								rows="4"
								maxlength="1000"
								required
								class="rounded-md border border-border bg-transparent p-3 text-sm text-foreground"
								>{data.request.descripcion}</textarea
							>
						</div>

						<Button type="submit" class="min-h-11 sm:col-span-2" disabled={busy}>
							Guardar cambios del encargo
						</Button>
					</form>
				{:else}
					<p class="text-sm text-muted-foreground">
						{data.request.custom_request_types?.nombre ?? 'Otro'}
						{#if data.request.custom_request_types?.precio_desde != null}
							· desde {formatMoney(data.request.custom_request_types.precio_desde)}
						{/if}
						· {data.request.cantidad}
						{data.request.cantidad === 1 ? 'pieza' : 'piezas'}
						{#if data.request.fecha_deseada}
							· para el {date.format(new Date(`${data.request.fecha_deseada}T00:00:00Z`))}
						{/if}
					</p>

					{#if data.request.tipo_producto || data.request.color || (Array.isArray(data.request.desglose_tallas) && data.request.desglose_tallas.length)}
						<div class="mt-2.5 flex flex-wrap gap-2 text-xs">
							{#if data.request.tipo_producto}
								<span
									class="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-semibold text-foreground"
								>
									{data.request.tipo_producto}
								</span>
							{/if}
							{#if data.request.color}
								<span
									class="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-foreground"
								>
									Color: <strong>{data.request.color}</strong>
								</span>
							{/if}
							{#if Array.isArray(data.request.desglose_tallas) && data.request.desglose_tallas.length}
								<span
									class="rounded-md border border-gold/40 bg-gold-fill/10 px-2.5 py-1 font-medium text-foreground"
								>
									Tallas: {(
										data.request.desglose_tallas as Array<{ talla: string; cantidad: number }>
									)
										.map((item) => `${item.cantidad}x ${item.talla}`)
										.join(', ')}
								</span>
							{/if}
						</div>
					{/if}

					<p class="mt-3 text-sm whitespace-pre-line text-foreground">{data.request.descripcion}</p>
				{/if}

				{#if data.request.referencias.length}
					<ul class="mt-4 flex flex-wrap gap-3">
						{#each data.request.referencias as reference, i (reference.thumb)}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- signed ImageKit URL -->
								<a href={reference.full} target="_blank" rel="noopener" class="block">
									<img
										src={reference.thumb}
										alt="Referencia {i + 1}"
										class="size-28 rounded-lg border border-border object-cover"
									/>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<div class="mb-4 flex items-center justify-between gap-2">
					<h2 class={heading}>Productos ({order.order_items.length})</h2>
					{#if !closed}
						<button
							type="button"
							class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
							onclick={() => (editingItems ? (editingItems = false) : openItemsEditor())}
						>
							{#if editingItems}
								<X size={14} strokeWidth={1.75} aria-hidden="true" /> Cancelar
							{:else}
								<Pencil size={14} strokeWidth={1.75} aria-hidden="true" /> Editar / agregar partidas
							{/if}
						</button>
					{/if}
				</div>

				{#if editingItems && !closed}
					<form method="POST" action="?/partidas" use:enhance={submit} class="flex flex-col gap-4">
						<input type="hidden" name="items_json" value={draftItemsJson} />
						<input type="hidden" name="desc_mayoreo" value={draftMayoreoPesos} />

						<div class="rounded-lg border border-border bg-surface-raised/60 p-3">
							<Label for="add-catalog-item" class="mb-1.5 block text-xs text-muted-foreground">
								Agregar producto del catálogo o partida libre
							</Label>
							<div class="flex flex-wrap gap-2">
								<select
									id="add-catalog-item"
									bind:value={selectedProductId}
									class="min-h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground"
								>
									<option value="">Elegir del catálogo…</option>
									{#each data.catalogProducts as prod (prod.id)}
										<option value={prod.id}>
											{prod.nombre} — {formatMoney(prod.precio_unitario)}
										</option>
									{/each}
								</select>
								<Button
									type="button"
									variant="outline"
									class="min-h-10 text-xs"
									disabled={!selectedProductId}
									onclick={addCatalogLine}
								>
									<PackagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
									Del catálogo
								</Button>
								<Button
									type="button"
									variant="outline"
									class="min-h-10 text-xs"
									onclick={addFreeLine}
								>
									<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
									Partida libre
								</Button>
							</div>
						</div>

						{#each draftLines as line, idx (line.key)}
							{@const catalogProd = catalogProductById(line.product_id)}
							<div class="rounded-lg border border-border bg-surface-raised/30 p-3.5">
								<div class="mb-2 flex items-center justify-between gap-2">
									<span class="text-xs font-semibold text-muted-foreground uppercase">
										Partida #{idx + 1}
									</span>
									{#if draftLines.length > 1}
										<button
											type="button"
											class="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs text-danger hover:bg-danger/10"
											onclick={() => removeDraftLine(line.key)}
										>
											<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Quitar
										</button>
									{/if}
								</div>

								<div class="grid gap-3 sm:grid-cols-6">
									<div class="flex flex-col gap-1 sm:col-span-3">
										<Label for="dl-nombre-{line.key}">Producto / Concepto</Label>
										<Input
											id="dl-nombre-{line.key}"
											bind:value={line.nombre_snapshot}
											required
											class="min-h-10"
										/>
									</div>
									<div class="flex flex-col gap-1 sm:col-span-1">
										<Label for="dl-cant-{line.key}">Cant.</Label>
										<Input
											id="dl-cant-{line.key}"
											type="number"
											min="1"
											max="999"
											bind:value={line.cantidad}
											required
											class="min-h-10 tabular-nums"
										/>
									</div>
									<div class="flex flex-col gap-1 sm:col-span-1">
										<Label for="dl-precio-{line.key}">Precio ($)</Label>
										<Input
											id="dl-precio-{line.key}"
											inputmode="decimal"
											bind:value={line.precio_pesos}
											required
											class="min-h-10 tabular-nums"
										/>
									</div>
									<div class="flex flex-col gap-1 sm:col-span-1">
										<Label for="dl-rec-{line.key}">Recargo ($)</Label>
										<Input
											id="dl-rec-{line.key}"
											inputmode="decimal"
											bind:value={line.recargo_pesos}
											class="min-h-10 tabular-nums"
										/>
									</div>

									<div class="flex flex-col gap-1 sm:col-span-2">
										<Label for="dl-color-{line.key}">Color</Label>
										{#if catalogProd && catalogProd.colores.length > 0}
											<select id="dl-color-{line.key}" bind:value={line.color} class={selectClass}>
												<option value="">Sin color</option>
												{#each catalogProd.colores as c (c)}
													<option value={c}>{c}</option>
												{/each}
											</select>
										{:else}
											<Input id="dl-color-{line.key}" bind:value={line.color} class="min-h-10" />
										{/if}
									</div>

									<div class="flex flex-col gap-1 sm:col-span-2">
										<Label for="dl-talla-{line.key}">Talla</Label>
										{#if catalogProd && catalogProd.tallas.length > 0}
											<select
												id="dl-talla-{line.key}"
												value={line.talla}
												onchange={(e) => onDraftSizeChange(line, e.currentTarget.value)}
												class={selectClass}
											>
												<option value="">Sin talla</option>
												{#each catalogProd.tallas as t (t)}
													<option value={t}>{t}</option>
												{/each}
											</select>
										{:else}
											<Input
												id="dl-talla-{line.key}"
												bind:value={line.talla}
												class="min-h-10 uppercase"
											/>
										{/if}
									</div>

									<div class="flex flex-col gap-1 sm:col-span-2">
										<Label for="dl-pers-{line.key}">Personalización</Label>
										<Input
											id="dl-pers-{line.key}"
											bind:value={line.personalizacion_texto}
											class="min-h-10"
										/>
									</div>
								</div>
							</div>
						{/each}

						<div
							class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-raised p-3 text-sm"
						>
							<span>
								Nuevo subtotal:
								<strong class="text-gold tabular-nums">{formatMoney(draftSubtotalCents)}</strong>
							</span>
							<Button type="submit" class="min-h-10" disabled={busy}>Guardar partidas</Button>
						</div>
					</form>
				{:else}
					<ul class="divide-y divide-border text-sm">
						{#each order.order_items as item (item.id)}
							<li class="flex justify-between gap-4 py-3">
								<span>
									{item.cantidad}× {item.nombre_snapshot}
									<span class="block text-xs text-muted-foreground">
										{[
											item.color,
											item.talla && `Talla ${item.talla}`,
											`Precio u. ${formatMoney(item.precio_unitario)}`
										]
											.filter(Boolean)
											.join(' · ')}
										{#if item.recargo_talla}· recargo {formatMoney(item.recargo_talla)} c/u{/if}
									</span>
									{#if item.personalizacion_texto}
										<span class="mt-1 block text-xs text-purple-light">
											<Pencil size={14} strokeWidth={1.75} class="mr-1 inline" aria-hidden="true" />
											{item.personalizacion_texto}
										</span>
									{/if}
								</span>
								<span class="tabular-nums">
									{formatMoney((item.precio_unitario + item.recargo_talla) * item.cantidad)}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
			{#if order.notas_cliente}
				<p class="mt-4 rounded-md bg-surface-raised p-3 text-sm whitespace-pre-line">
					<span class="text-muted-foreground">Notas del cliente:</span>
					{order.notas_cliente}
				</p>
			{/if}
		</section>

		<!-- Quote & Discounts -->
		<section class={card}>
			<h2 class="mb-4 {heading}">Cotización y descuentos</h2>
			<form method="POST" action="?/cotizar" use:enhance={submit} class="grid gap-4 sm:grid-cols-2">
				{#if order.tipo === 'encargo'}
					<div class="flex flex-col gap-2">
						<Label for="precio_final">Precio del encargo (MXN)</Label>
						<Input
							id="precio_final"
							name="precio_final"
							inputmode="decimal"
							value={centsToInput(data.request?.precio_final ?? null)}
							placeholder="Por cotizar"
							disabled={closed}
							class="min-h-11 tabular-nums"
						/>
					</div>
				{:else}
					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between gap-2">
							<Label for="precio_final">Precio de partidas / Subtotal (MXN)</Label>
							<span class="text-xs text-muted-foreground">
								Suma: {formatMoney(
									order.order_items.reduce(
										(sum, item) =>
											sum + (item.precio_unitario + item.recargo_talla) * item.cantidad,
										0
									)
								)}
							</span>
						</div>
						<Input
							id="precio_final"
							name="precio_final"
							inputmode="decimal"
							value={centsToInput(order.subtotal)}
							placeholder="Por cotizar"
							disabled={closed}
							class="min-h-11 tabular-nums"
						/>
					</div>
				{/if}
				<div class="flex flex-col gap-2">
					<Label for="envio">Envío (MXN)</Label>
					<Input
						id="envio"
						name="envio"
						inputmode="decimal"
						value={order.metodo_entrega === 'recoger' ? '0' : centsToInput(order.envio)}
						placeholder={order.metodo_entrega === 'recoger' ? '0 (Recoger)' : 'Por cotizar'}
						disabled={closed || order.metodo_entrega === 'recoger'}
						class="min-h-11 tabular-nums"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="personalizacion">Personalización (MXN)</Label>
					<Input
						id="personalizacion"
						name="personalizacion"
						inputmode="decimal"
						value={centsToInput(order.personalizacion)}
						placeholder={order.order_items.some((item) => item.personalizacion_texto)
							? 'Por cotizar'
							: 'No aplica'}
						disabled={closed}
						class="min-h-11 tabular-nums"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="desc_mayoreo">Descuento mayoreo (MXN)</Label>
					<Input
						id="desc_mayoreo"
						name="desc_mayoreo"
						inputmode="decimal"
						value={centsToInput(order.desc_mayoreo)}
						placeholder="0"
						disabled={closed}
						class="min-h-11 tabular-nums"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="desc_cupon">Descuento especial / cupón (MXN)</Label>
					<Input
						id="desc_cupon"
						name="desc_cupon"
						inputmode="decimal"
						value={centsToInput(order.desc_cupon)}
						placeholder="0"
						disabled={closed}
						class="min-h-11 tabular-nums"
					/>
				</div>
				<div class="flex flex-col gap-2 sm:col-span-2">
					<div class="flex items-center justify-between gap-2">
						<Label for="anticipo">Anticipo requerido (MXN)</Label>
						{#if !closed && data.suggestedDeposit > 0}
							<button
								type="button"
								class="inline-flex items-center gap-1 text-xs text-gold hover:underline"
								onclick={() => {
									quoteAnticipoInput = centsToInput(data.suggestedDeposit);
									quoteAnticipoManual = false;
								}}
							>
								<Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
								Usar sugerido ({formatMoney(data.suggestedDeposit)})
							</button>
						{/if}
					</div>
					<Input
						id="anticipo"
						name="anticipo"
						inputmode="decimal"
						bind:value={quoteAnticipoInput}
						oninput={() => (quoteAnticipoManual = true)}
						placeholder="Sugerido: {centsToInput(data.suggestedDeposit)}"
						disabled={closed}
						class="min-h-11 tabular-nums"
					/>
				</div>
				<dl
					class="grid grid-cols-2 gap-1 self-end rounded-lg bg-surface-raised p-3.5 text-sm sm:col-span-2"
				>
					<dt class="text-muted-foreground">Subtotal</dt>
					<dd class="text-right tabular-nums">{formatMoney(order.subtotal)}</dd>
					{#if order.desc_mayoreo + order.desc_cupon}
						<dt class="text-muted-foreground">Descuentos</dt>
						<dd class="text-right text-success tabular-nums">
							−{formatMoney(order.desc_mayoreo + order.desc_cupon)}
						</dd>
					{/if}
					{#if order.personalizacion != null && order.personalizacion > 0}
						<dt class="text-muted-foreground">Personalización</dt>
						<dd class="text-right tabular-nums">{formatMoney(order.personalizacion)}</dd>
					{/if}
					{#if order.envio != null && order.envio > 0}
						<dt class="text-muted-foreground">Envío</dt>
						<dd class="text-right tabular-nums">{formatMoney(order.envio)}</dd>
					{/if}
					<dt class="pt-1 font-medium">Total</dt>
					<dd class="pt-1 text-right text-lg font-semibold text-gold tabular-nums">
						{formatMoney(order.total)}
					</dd>
				</dl>
				{#if !closed}
					<Button type="submit" class="min-h-11 sm:col-span-2" disabled={busy}>
						Guardar cotización y descuentos
					</Button>
				{/if}
			</form>
		</section>

		<!-- Payments -->
		<section class={card}>
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
				<h2 class={heading}>Pagos</h2>
				<p class="text-sm">
					Pagado <span class="tabular-nums">{formatMoney(data.balance.pagado)}</span> · Saldo
					<span
						class="font-semibold tabular-nums {data.balance.saldo > 0
							? 'text-warning'
							: 'text-success'}"
					>
						{formatMoney(data.balance.saldo)}
					</span>
					{#if data.balance.liquidado}
						<span class="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
							>Liquidado</span
						>
					{/if}
				</p>
			</div>
			{#if order.payments.length}
				<ul class="mb-4 divide-y divide-border text-sm">
					{#each order.payments as payment (payment.id)}
						<li class="flex items-center justify-between gap-3 py-2">
							<span>
								{PAYMENT_TYPES.find((type) => type.value === payment.tipo)?.label}
								<span class="text-muted-foreground">
									· {payment.metodo} · {dateTime.format(new Date(payment.fecha))}
								</span>
							</span>
							<span class="flex items-center gap-2">
								<span class="tabular-nums">{formatMoney(payment.monto)}</span>
								<form method="POST" action="?/eliminarPago" use:enhance={submit}>
									<input type="hidden" name="id" value={payment.id} />
									<button
										type="submit"
										aria-label="Eliminar pago"
										title="Eliminar pago capturado por error"
										class="grid size-8 place-items-center rounded text-muted-foreground hover:bg-danger/10 hover:text-danger"
										onclick={(event) => {
											if (!confirm(`¿Eliminar este pago de ${formatMoney(payment.monto)}?`)) {
												event.preventDefault();
											}
										}}
									>
										<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
									</button>
								</form>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if order.estado !== 'cancelado' && data.balance.saldo > 0}
				<form method="POST" action="?/pago" use:enhance={submit} class="grid gap-3 sm:grid-cols-2">
					<!-- Quick payment chips (QoL) -->
					<div class="flex flex-wrap gap-1.5 sm:col-span-2">
						{#if order.anticipo_requerido && order.anticipo_requerido <= data.balance.saldo}
							<button
								type="button"
								class="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground hover:border-gold"
								onclick={() => {
									paymentTipoManual = false;
									updatePaymentTypeForAmount(centsToInput(order.anticipo_requerido));
								}}
							>
								Anticipo requerido ({formatMoney(order.anticipo_requerido)})
							</button>
						{:else if !order.payments.length && data.suggestedDeposit > 0 && data.suggestedDeposit <= data.balance.saldo}
							<button
								type="button"
								class="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground hover:border-gold"
								onclick={() => {
									paymentTipoManual = false;
									updatePaymentTypeForAmount(centsToInput(data.suggestedDeposit));
								}}
							>
								50% sugerido ({formatMoney(data.suggestedDeposit)})
							</button>
						{/if}
						<button
							type="button"
							class="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground hover:border-gold"
							onclick={() => {
								paymentTipoManual = false;
								updatePaymentTypeForAmount(centsToInput(data.balance.saldo));
							}}
						>
							Liquidar saldo ({formatMoney(data.balance.saldo)})
						</button>
					</div>

					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between gap-2">
							<Label for="tipo">Tipo</Label>
							{#if !paymentTipoManual}
								<span class="text-[11px] text-muted-foreground">Auto por monto</span>
							{/if}
						</div>
						<select
							id="tipo"
							name="tipo"
							bind:value={paymentTipo}
							onchange={() => (paymentTipoManual = true)}
							class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
						>
							{#each PAYMENT_TYPES as type (type.value)}
								<option value={type.value}>
									{type.label}
								</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="monto">Monto (MXN)</Label>
						<Input
							id="monto"
							name="monto"
							inputmode="decimal"
							required
							value={paymentMonto}
							oninput={(e) => updatePaymentTypeForAmount(e.currentTarget.value)}
							placeholder={centsToInput(
								order.payments.length
									? data.balance.saldo
									: (order.anticipo_requerido ?? data.suggestedDeposit)
							)}
							class="min-h-11 tabular-nums"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="metodo">Método</Label>
						<select
							id="metodo"
							name="metodo"
							bind:value={paymentMetodo}
							class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
						>
							{#each PAYMENT_METHODS as method (method)}
								<option value={method}>{method}</option>
							{/each}
						</select>
						{#if paymentMetodo === 'Otro'}
							<Input
								id="metodo_otro"
								name="metodo_otro"
								bind:value={paymentMetodoOtro}
								maxlength={60}
								placeholder="Especifica el método…"
								class="mt-1 min-h-11"
							/>
						{/if}
					</div>
					<div class="flex flex-col justify-end gap-1">
						<input
							type="hidden"
							name="fecha"
							value={showCustomFecha && paymentFecha ? paymentFecha : today}
						/>
						<div
							class="flex min-h-11 items-center justify-between rounded-md border border-border/60 bg-surface-raised/40 px-3 text-xs text-muted-foreground"
						>
							<span
								>Fecha: <strong class="font-medium text-foreground"
									>{showCustomFecha && paymentFecha ? paymentFecha : `Hoy (${today})`}</strong
								></span
							>
							<button
								type="button"
								class="text-gold hover:underline"
								onclick={() => {
									showCustomFecha = !showCustomFecha;
									if (showCustomFecha && !paymentFecha) paymentFecha = today;
								}}
							>
								{showCustomFecha ? 'Usar hoy' : 'Cambiar fecha'}
							</button>
						</div>
					</div>
					{#if showCustomFecha}
						<div class="flex flex-col gap-2 sm:col-span-2">
							<Label for="fecha_picker">Fecha específica del pago</Label>
							<Input
								id="fecha_picker"
								type="date"
								bind:value={paymentFecha}
								max={today}
								class="min-h-11 [color-scheme:dark]"
							/>
						</div>
					{/if}
					<Button type="submit" variant="outline" class="min-h-11 sm:col-span-2" disabled={busy}>
						Registrar pago
					</Button>
				</form>
			{/if}
		</section>
	</div>

	<div class="flex flex-col gap-6">
		<!-- Status + Status Rollback/Reopen (Spec S4) -->
		<section class={card}>
			<h2 class="mb-4 {heading}">Estado</h2>
			{#if data.next.length}
				<form method="POST" action="?/estado" use:enhance={submit} class="flex flex-col gap-3">
					<Label for="nota">Nota para el historial (opcional)</Label>
					<Input id="nota" name="nota" maxlength={300} class="min-h-11" />
					<div class="flex flex-wrap gap-2">
						{#each data.next as status (status)}
							<Button
								type="submit"
								name="estado"
								value={status}
								variant={status === 'cancelado' ? 'ghost' : 'default'}
								class="min-h-11 {status === 'cancelado' ? 'text-danger' : ''}"
								disabled={busy}
								onclick={(event) => {
									if (status === 'cancelado' && !confirm(`¿Cancelar el pedido ${order.folio}?`)) {
										event.preventDefault();
									}
								}}
							>
								{status === 'cancelado' ? 'Cancelar pedido' : `Pasar a ${STATUS_LABELS[status]}`}
							</Button>
						{/each}
					</div>
					{#if data.next.includes('confirmado') && !order.payments.some((payment) => payment.tipo === 'anticipo')}
						<p class="text-xs text-muted-foreground">
							Para confirmar, registra antes el pago del anticipo.
						</p>
					{/if}
				</form>
			{:else}
				<p class="text-sm text-muted-foreground">El pedido está cerrado.</p>
			{/if}

			<!-- Spec S4: Reopen or rollback status with mandatory audit note -->
			<details class="mt-4 rounded-lg border border-border bg-surface-raised/40 p-3 text-sm">
				<summary
					class="flex cursor-pointer items-center gap-2 font-medium text-muted-foreground hover:text-foreground"
				>
					<RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
					Corregir o regresar estado por error
				</summary>
				<form
					method="POST"
					action="?/revertirEstado"
					use:enhance={submit}
					class="mt-3 flex flex-col gap-3"
				>
					<div class="flex flex-col gap-1.5">
						<Label for="override-estado">Mover al estado</Label>
						<select id="override-estado" name="estado" required class={selectClass}>
							{#each data.overrideStatuses as status (status)}
								<option value={status}>{STATUS_LABELS[status]}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<Label for="override-nota">Motivo de la corrección (obligatorio)</Label>
						<Input
							id="override-nota"
							name="nota"
							required
							minlength={3}
							maxlength={300}
							placeholder="Ej. Se marcó listo por accidente"
							class="min-h-11"
						/>
					</div>
					<Button type="submit" variant="outline" class="min-h-10" disabled={busy}>
						Aplicar corrección de estado
					</Button>
				</form>
			</details>

			<ol class="mt-5 flex flex-col gap-3 border-l border-border pl-4 text-sm">
				{#each order.order_events as event (event.id)}
					<li>
						<OrderStatusBadge estado={event.estado} />
						<span class="ml-1 text-xs text-muted-foreground"
							>{dateTime.format(new Date(event.fecha))}</span
						>
						{#if event.nota}<p class="mt-1 text-muted-foreground">{event.nota}</p>{/if}
					</li>
				{/each}
			</ol>
		</section>

		<!-- Customer and delivery (View & Edit modes) -->
		<section class={card}>
			<div class="mb-4 flex items-center justify-between gap-2">
				<h2 class={heading}>Cliente y entrega</h2>
				{#if !closed}
					<button
						type="button"
						class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
						onclick={() => (editingCustomer ? (editingCustomer = false) : openCustomerEditor())}
					>
						{#if editingCustomer}
							<X size={14} strokeWidth={1.75} aria-hidden="true" /> Cancelar
						{:else}
							<Pencil size={14} strokeWidth={1.75} aria-hidden="true" /> Editar datos
						{/if}
					</button>
				{/if}
			</div>

			{#if editingCustomer && !closed}
				<form method="POST" action="?/datos" use:enhance={submit} class="grid gap-3 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<Label for="edit-nombre">Nombre del cliente</Label>
						<Input
							id="edit-nombre"
							name="cliente_nombre"
							value={order.cliente_nombre}
							maxlength={80}
							required
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<Label for="edit-wa">WhatsApp (10 dígitos)</Label>
						<Input
							id="edit-wa"
							name="cliente_whatsapp"
							value={order.cliente_whatsapp.replace(/^52/, '')}
							inputmode="numeric"
							required
							class="min-h-11 tabular-nums"
						/>
					</div>
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<Label for="edit-metodo">Método de entrega</Label>
						<select
							id="edit-metodo"
							name="metodo_entrega"
							bind:value={editMetodoEntrega}
							class={selectClass}
						>
							{#each DELIVERY_METHODS as method (method.value)}
								<option value={method.value}>{method.label}</option>
							{/each}
						</select>
					</div>

					{#if editMetodoEntrega !== 'recoger'}
						<div class="flex flex-col gap-1.5 sm:col-span-2">
							<Label for="edit-calle">Calle y número</Label>
							<Input
								id="edit-calle"
								name="calle"
								value={address?.calle ?? ''}
								maxlength={120}
								required
								class="min-h-11"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="edit-colonia">Colonia</Label>
							<Input
								id="edit-colonia"
								name="colonia"
								value={address?.colonia ?? ''}
								maxlength={80}
								required
								class="min-h-11"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="edit-cp">Código postal</Label>
							<Input
								id="edit-cp"
								name="cp"
								inputmode="numeric"
								value={address?.cp ?? ''}
								maxlength={5}
								required
								class="min-h-11 tabular-nums"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="edit-ciudad">Ciudad</Label>
							<Input
								id="edit-ciudad"
								name="ciudad"
								value={address?.ciudad ?? ''}
								maxlength={80}
								required
								class="min-h-11"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="edit-estado-dir">Estado</Label>
							<Input
								id="edit-estado-dir"
								name="estado"
								value={address?.estado ?? 'Chiapas'}
								maxlength={60}
								required
								class="min-h-11"
							/>
						</div>
						<div class="flex flex-col gap-1.5 sm:col-span-2">
							<Label for="edit-ref">Referencias</Label>
							<Input
								id="edit-ref"
								name="referencias"
								value={address?.referencias ?? ''}
								maxlength={200}
								class="min-h-11"
							/>
						</div>
					{/if}

					{#if editMetodoEntrega === 'paqueteria'}
						<div class="flex flex-col gap-1.5 sm:col-span-2">
							<Label for="edit-guia">Número de guía</Label>
							<Input
								id="edit-guia"
								name="guia"
								value={order.guia ?? ''}
								maxlength={80}
								class="min-h-11"
							/>
						</div>
					{/if}

					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<Label for="edit-notas-cliente">Notas del cliente / pedido</Label>
						<textarea
							id="edit-notas-cliente"
							name="notas_cliente"
							rows="2"
							maxlength="500"
							class="rounded-md border border-border bg-transparent p-3 text-sm text-foreground"
							>{order.notas_cliente}</textarea
						>
					</div>

					<Button type="submit" class="min-h-11 sm:col-span-2" disabled={busy}>
						Guardar cliente y entrega
					</Button>
				</form>
			{:else}
				<dl class="flex flex-col gap-2 text-sm">
					<div>
						<dt class="text-muted-foreground">Nombre</dt>
						<dd>{order.cliente_nombre}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">WhatsApp</dt>
						<dd class="tabular-nums">
							+{order.cliente_whatsapp.slice(0, 2)}
							{order.cliente_whatsapp.slice(2)}
						</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Entrega</dt>
						<dd>{deliveryLabel(order.metodo_entrega)}</dd>
					</div>
					{#if address}
						<div>
							<dt class="text-muted-foreground">Dirección</dt>
							<dd>
								{address.calle}, {address.colonia}<br />
								{address.cp}
								{address.ciudad}, {address.estado}
								{#if address.referencias}<br /><span class="text-muted-foreground"
										>{address.referencias}</span
									>{/if}
							</dd>
						</div>
					{/if}
				</dl>
				{#if order.metodo_entrega === 'paqueteria'}
					<form
						method="POST"
						action="?/guia"
						use:enhance={submit}
						class="mt-4 flex items-end gap-2"
					>
						<div class="flex flex-1 flex-col gap-2">
							<Label for="guia">Número de guía</Label>
							<Input
								id="guia"
								name="guia"
								value={order.guia ?? ''}
								maxlength={80}
								disabled={closed}
								class="min-h-11"
							/>
						</div>
						{#if !closed}
							<Button type="submit" variant="outline" class="min-h-11" disabled={busy}>
								Guardar
							</Button>
						{/if}
					</form>
				{/if}
			{/if}
		</section>

		<!-- Internal notes -->
		<section class={card}>
			<h2 class="mb-4 {heading}">Notas internas</h2>
			<form method="POST" action="?/nota" use:enhance={submit} class="flex flex-col gap-2">
				<Label for="texto" class="sr-only">Nueva nota</Label>
				<textarea
					id="texto"
					name="texto"
					rows="2"
					maxlength="1000"
					required
					placeholder="Solo tú la ves"
					class="rounded-md border border-border bg-transparent p-3 text-sm"></textarea>
				<Button type="submit" variant="outline" class="min-h-11" disabled={busy}
					>Agregar nota</Button
				>
			</form>
			{#if order.order_notes.length}
				<ul class="mt-4 flex flex-col gap-3 text-sm">
					{#each order.order_notes as note (note.id)}
						<li class="flex items-start justify-between gap-2 rounded-md bg-surface-raised p-3">
							<div>
								<p class="whitespace-pre-line">{note.texto}</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{dateTime.format(new Date(note.fecha))}
								</p>
							</div>
							<form method="POST" action="?/eliminarNota" use:enhance={submit}>
								<input type="hidden" name="id" value={note.id} />
								<button
									type="submit"
									aria-label="Eliminar nota"
									class="grid size-8 place-items-center rounded text-muted-foreground hover:bg-danger/10 hover:text-danger"
									onclick={(event) => {
										if (!confirm('¿Eliminar esta nota interna?')) event.preventDefault();
									}}
								>
									<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Files -->
		<section class={card}>
			<h2 class="mb-4 {heading}">Archivos</h2>
			<p class="mb-3 text-xs text-muted-foreground">
				Comprobantes, fotos del trabajo terminado, etc.
			</p>
			<form
				method="POST"
				action="?/archivo"
				enctype="multipart/form-data"
				use:enhance={submit}
				class="flex flex-col gap-2"
			>
				<label
					class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-purple-light hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring"
				>
					<ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
					<span class="truncate">{fileName ?? 'Elegir imagen'}</span>
					<input
						id="archivo"
						name="archivo"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						required
						onchange={(event) => (fileName = event.currentTarget.files?.[0]?.name ?? null)}
						class="sr-only"
					/>
				</label>
				<Input
					name="descripcion"
					maxlength={120}
					placeholder="Descripción (opcional)"
					class="min-h-11"
				/>
				<Button type="submit" variant="outline" class="min-h-11" disabled={busy}
					>Subir imagen</Button
				>
			</form>
			{#if order.order_files.length}
				<ul class="mt-4 grid grid-cols-2 gap-3">
					{#each order.order_files as file (file.id)}
						<li class="relative">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- signed ImageKit URL -->
							<a href={file.full} target="_blank" rel="noopener" class="block">
								<img
									src={file.thumb}
									alt={file.descripcion ?? 'Archivo del pedido'}
									class="aspect-square w-full rounded-lg border border-border object-cover"
								/>
							</a>
							{#if file.descripcion}<p class="mt-1 truncate text-xs text-muted-foreground">
									{file.descripcion}
								</p>{/if}
							<form
								method="POST"
								action="?/eliminarArchivo"
								use:enhance={submit}
								class="absolute top-1 right-1"
							>
								<input type="hidden" name="id" value={file.id} />
								<button
									type="submit"
									aria-label="Eliminar imagen"
									class="grid size-11 place-items-center"
									onclick={(event) => {
										if (!confirm('¿Eliminar esta imagen?')) event.preventDefault();
									}}
								>
									<span
										class="grid size-8 place-items-center rounded-full bg-background/80 text-danger"
									>
										<Trash2 size={16} strokeWidth={1.75} />
									</span>
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>
