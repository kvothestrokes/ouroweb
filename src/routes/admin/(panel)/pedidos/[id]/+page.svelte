<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ImagePlus, MessageCircle, Pencil, Send, Trash2 } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import OrderStatusBadge from '#lib/components/admin/OrderStatusBadge.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { deliveryLabel } from '#lib/domain/checkout.js';
	import { centsToInput, formatMoney } from '#lib/domain/money.js';
	import { PAYMENT_TYPES } from '#lib/domain/order-admin.js';
	import { STATUS_LABELS } from '#lib/domain/order-status.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const order = $derived(data.order);
	let busy = $state(false);
	let fileName = $state<string | null>(null);

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update, result }) => {
			await update();
			busy = false;
			if (result.type === 'success') fileName = null;
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
	const card = 'rounded-xl border border-border bg-card p-5';
	const heading = 'mb-4 font-display text-lg text-foreground';
</script>

<svelte:head>
	<title>{order.folio} · Pedidos · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/pedidos')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" /> Pedidos
</a>

<div class="mt-2 flex flex-wrap items-center gap-3">
	<h1 class="font-display text-2xl text-foreground tabular-nums md:text-3xl">{order.folio}</h1>
	<OrderStatusBadge estado={order.estado} />
	<span class="text-sm text-muted-foreground">
		{order.tipo === 'encargo' ? 'Encargo especial' : 'Catálogo'} · {dateTime.format(
			new Date(order.created_at)
		)}
	</span>
</div>

<div class="mt-4 flex flex-wrap gap-2">
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
		<!-- What was ordered -->
		<section class={card}>
			{#if data.request}
				<h2 class={heading}>Encargo</h2>
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
				<p class="mt-3 text-sm whitespace-pre-line text-foreground">{data.request.descripcion}</p>
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
				<h2 class={heading}>Productos</h2>
				<ul class="divide-y divide-border text-sm">
					{#each order.order_items as item (item.id)}
						<li class="flex justify-between gap-4 py-3">
							<span>
								{item.cantidad}× {item.nombre_snapshot}
								<span class="block text-xs text-muted-foreground">
									{[item.color, item.talla && `Talla ${item.talla}`].filter(Boolean).join(' · ')}
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
			{#if order.notas_cliente}
				<p class="mt-4 rounded-md bg-surface-raised p-3 text-sm whitespace-pre-line">
					<span class="text-muted-foreground">Notas del cliente:</span>
					{order.notas_cliente}
				</p>
			{/if}
		</section>

		<!-- Quote -->
		<section class={card}>
			<h2 class={heading}>Cotización</h2>
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
							class="min-h-11"
						/>
					</div>
				{/if}
				<div class="flex flex-col gap-2">
					<Label for="envio">Envío (MXN)</Label>
					<Input
						id="envio"
						name="envio"
						inputmode="decimal"
						value={centsToInput(order.envio)}
						placeholder="Por cotizar"
						disabled={closed}
						class="min-h-11"
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
						class="min-h-11"
					/>
				</div>
				<div class="flex flex-col gap-2">
					<Label for="anticipo">Anticipo requerido (MXN)</Label>
					<Input
						id="anticipo"
						name="anticipo"
						inputmode="decimal"
						value={centsToInput(order.anticipo_requerido)}
						placeholder="Sugerido: {centsToInput(data.suggestedDeposit)}"
						disabled={closed}
						class="min-h-11"
					/>
					<span class="text-xs text-muted-foreground">
						Sugerido {formatMoney(data.suggestedDeposit)} del total actual.
					</span>
				</div>
				<dl class="grid grid-cols-2 gap-1 self-end text-sm sm:col-span-2">
					<dt class="text-muted-foreground">Subtotal</dt>
					<dd class="text-right tabular-nums">{formatMoney(order.subtotal)}</dd>
					{#if order.desc_mayoreo + order.desc_cupon}
						<dt class="text-muted-foreground">Descuentos</dt>
						<dd class="text-right text-success tabular-nums">
							−{formatMoney(order.desc_mayoreo + order.desc_cupon)}
						</dd>
					{/if}
					<dt class="font-medium">Total</dt>
					<dd class="text-right text-lg font-semibold text-gold tabular-nums">
						{formatMoney(order.total)}
					</dd>
				</dl>
				{#if !closed}
					<Button type="submit" class="min-h-11 sm:col-span-2" disabled={busy}>
						Guardar cotización
					</Button>
				{/if}
			</form>
		</section>

		<!-- Payments -->
		<section class={card}>
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-display text-lg text-foreground">Pagos</h2>
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
						<li class="flex justify-between gap-4 py-2">
							<span>
								{PAYMENT_TYPES.find((type) => type.value === payment.tipo)?.label}
								<span class="text-muted-foreground">
									· {payment.metodo} · {dateTime.format(new Date(payment.fecha))}
								</span>
							</span>
							<span class="tabular-nums">{formatMoney(payment.monto)}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if order.estado !== 'cancelado' && data.balance.saldo > 0}
				<form method="POST" action="?/pago" use:enhance={submit} class="grid gap-3 sm:grid-cols-2">
					<div class="flex flex-col gap-2">
						<Label for="tipo">Tipo</Label>
						<select
							id="tipo"
							name="tipo"
							class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm"
						>
							{#each PAYMENT_TYPES as type (type.value)}
								<option
									value={type.value}
									selected={type.value === (order.payments.length ? 'abono' : 'anticipo')}
								>
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
							placeholder={centsToInput(
								order.payments.length
									? data.balance.saldo
									: (order.anticipo_requerido ?? data.suggestedDeposit)
							)}
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="metodo">Método</Label>
						<Input
							id="metodo"
							name="metodo"
							maxlength={60}
							placeholder="Transferencia"
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="fecha">Fecha</Label>
						<Input
							id="fecha"
							name="fecha"
							type="date"
							value={today}
							max={today}
							class="min-h-11 [color-scheme:dark]"
						/>
					</div>
					<Button type="submit" variant="outline" class="min-h-11 sm:col-span-2" disabled={busy}>
						Registrar pago
					</Button>
				</form>
			{/if}
		</section>
	</div>

	<div class="flex flex-col gap-6">
		<!-- Status -->
		<section class={card}>
			<h2 class={heading}>Estado</h2>
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

		<!-- Customer and delivery -->
		<section class={card}>
			<h2 class={heading}>Cliente y entrega</h2>
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
				<form method="POST" action="?/guia" use:enhance={submit} class="mt-4 flex items-end gap-2">
					<div class="flex flex-1 flex-col gap-2">
						<Label for="guia">Número de guía</Label>
						<Input id="guia" name="guia" value={order.guia ?? ''} maxlength={80} class="min-h-11" />
					</div>
					<Button type="submit" variant="outline" class="min-h-11" disabled={busy}>Guardar</Button>
				</form>
			{/if}
		</section>

		<!-- Internal notes -->
		<section class={card}>
			<h2 class={heading}>Notas internas</h2>
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
						<li class="rounded-md bg-surface-raised p-3">
							<p class="whitespace-pre-line">{note.texto}</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{dateTime.format(new Date(note.fecha))}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Files -->
		<section class={card}>
			<h2 class={heading}>Archivos</h2>
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
