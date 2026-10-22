<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import OrderSummary from '#lib/components/store/OrderSummary.svelte';
	import { cartQuote, cartRows, toCheckoutItems } from '#lib/client/cart-view.js';
	import { DELIVERY_METHODS, parseCheckout, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { formatMoney } from '#lib/domain/money.js';
	import type { PlacedOrder } from '#lib/server/orders.js';
	import { cart } from '#lib/stores/cart.svelte.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const LAST_ORDER_KEY = 'ouroboros:ultimo-pedido';

	let ready = $state(false);
	let placed = $state<PlacedOrder | null>(null);
	$effect(() => {
		cart.load();
		try {
			const saved = sessionStorage.getItem(LAST_ORDER_KEY);
			if (saved && !cart.lines.length) placed = JSON.parse(saved);
		} catch {
			// No session storage: the success screen just won't survive a reload.
		}
		ready = true;
	});

	let nombre = $state('');
	let whatsapp = $state('');
	let metodoEntrega = $state<DeliveryMethod>('recoger');
	let direccion = $state({
		calle: '',
		colonia: '',
		cp: '',
		ciudad: '',
		estado: 'Chiapas',
		referencias: ''
	});
	let notas = $state('');
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);

	const rows = $derived(cartRows(cart.lines, data.products));
	const quote = $derived(cartQuote(cart.lines, data.products));
	const needsAddress = $derived(metodoEntrega !== 'recoger');
	const hasCustomization = $derived(cart.lines.some((line) => line.personalizacion));

	/** Which field a validation message belongs to. */
	const FIELD_FOR: Record<string, 'nombre' | 'whatsapp' | 'direccion'> = {
		'Escribe tu nombre.': 'nombre',
		'Escribe tu WhatsApp a 10 dígitos.': 'whatsapp',
		'Completa tu dirección de entrega.': 'direccion'
	};
	let errorField = $state<'nombre' | 'whatsapp' | 'direccion' | null>(null);

	function showError(message: string) {
		errorMessage = message;
		errorField = FIELD_FOR[message] ?? null;
		if (!errorField) return;
		const id =
			errorField === 'direccion'
				? (['calle', 'colonia', 'cp', 'ciudad', 'estado'] as const)
						.map((key) => `checkout-${key}`)
						.find((key) => !(document.getElementById(key) as HTMLInputElement | null)?.value.trim())
				: `checkout-${errorField}`;
		document.getElementById(id ?? 'checkout-calle')?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		const payload = {
			nombre,
			whatsapp,
			metodoEntrega,
			direccion: needsAddress ? direccion : null,
			notas,
			items: toCheckoutItems(cart.lines)
		};
		// Same validation as the server, to point at the field before sending.
		const local = parseCheckout(payload);
		if (!local.ok) {
			showError(local.message);
			return;
		}
		sending = true;
		errorMessage = null;
		errorField = null;
		try {
			const response = await fetch('/api/pedidos', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await response.json().catch(() => null);
			if (!response.ok) {
				showError(body?.message ?? 'No pudimos registrar tu pedido. Intenta de nuevo.');
				return;
			}
			placed = body as PlacedOrder;
			cart.clear();
			try {
				sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(placed));
			} catch {
				// See above.
			}
			window.scrollTo({ top: 0 });
		} catch {
			errorMessage = 'Revisa tu conexión e intenta de nuevo.';
		} finally {
			sending = false;
		}
	}

	/** Moves focus to the success heading so screen readers announce it. */
	const focusOnMount = (node: HTMLElement) => node.focus();

	const field =
		'h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-purple-light';
	const label = 'flex flex-col gap-1.5 text-sm';
</script>

<svelte:head>
	<title>{placed ? `Pedido ${placed.folio}` : 'Confirma tu pedido'} — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
	{#if !ready}
		<div class="h-96 animate-pulse rounded-2xl bg-surface-raised" aria-hidden="true"></div>
	{:else if placed}
		<!-- Success (spec 6.1, step 5) -->
		<section class="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
			<CircleCheck size={56} stroke-width={1.5} class="text-success" />
			<h1 class="text-3xl md:text-4xl" tabindex="-1" {@attach focusOnMount}>¡Pedido registrado!</h1>
			<div class="rounded-xl border border-gold/40 bg-surface px-6 py-4">
				<p class="text-xs tracking-widest text-muted-foreground uppercase">Tu folio</p>
				<p class="font-display text-3xl text-gold">{placed.folio}</p>
			</div>
			<p class="text-muted-foreground">
				Último paso: mándanos tu pedido por WhatsApp. Ahí te confirmamos el total final y los datos
				para el anticipo.
			</p>
			<ExternalLink
				href={placed.whatsappUrl}
				class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-gold-light sm:w-auto"
			>
				<MessageCircle size={20} stroke-width={1.75} />
				Enviar pedido por WhatsApp
			</ExternalLink>
			<ul class="w-full divide-y divide-border rounded-xl border border-border text-left text-sm">
				{#each placed.lines as line, i (i)}
					<li class="flex justify-between gap-4 px-4 py-3">
						<span>
							{line.cantidad}× {line.nombre}
							{#if line.detalle}<span class="block text-xs text-muted-foreground"
									>{line.detalle}</span
								>{/if}
						</span>
						<span class="tabular-nums">{formatMoney(line.importe)}</span>
					</li>
				{/each}
				<li class="flex justify-between gap-4 px-4 py-3 font-medium">
					<span>{placed.porCotizar ? 'Total estimado' : 'Total'}</span>
					<span class="text-gold tabular-nums">{formatMoney(placed.total)}</span>
				</li>
			</ul>
			<p class="text-xs text-muted-foreground">
				Guarda tu folio: con él y los últimos 4 dígitos de tu WhatsApp podrás seguir tu pedido.
			</p>
			<a
				href={resolve('/(store)')}
				onclick={() => {
					try {
						sessionStorage.removeItem(LAST_ORDER_KEY);
					} catch {
						// See above.
					}
				}}
				class="inline-flex min-h-11 items-center text-sm text-purple-light hover:underline"
			>
				Volver a la tienda
			</a>
		</section>
	{:else if !rows.length}
		<EmptyState title="Tu carrito está vacío">
			Agrega productos para hacer tu pedido.
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
		<h1 class="mb-2 text-3xl md:text-4xl">Confirma tu pedido</h1>
		<p class="mb-8 text-sm text-muted-foreground">
			No cobramos en línea: registramos tu pedido y lo confirmamos contigo por WhatsApp.
		</p>

		<div class="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
			<form
				id="checkout"
				onsubmit={submit}
				oninput={() => {
					errorMessage = null;
					errorField = null;
				}}
				onchange={() => (errorMessage = null)}
				class="flex flex-col gap-8"
				novalidate
			>
				{#if errorMessage && errorField}
					<p
						id="checkout-error"
						class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
						role="alert"
					>
						{errorMessage}
					</p>
				{/if}
				<fieldset class="flex flex-col gap-4">
					<legend class="mb-2 font-display text-lg">Tus datos</legend>
					<label class={label}>
						Nombre
						<input
							id="checkout-nombre"
							bind:value={nombre}
							aria-invalid={errorField === 'nombre' || undefined}
							aria-describedby={errorField === 'nombre' ? 'checkout-error' : undefined}
							name="nombre"
							autocomplete="name"
							required
							maxlength="80"
							class={field}
						/>
					</label>
					<div class="flex flex-col gap-1.5">
						<label class={label}>
							WhatsApp
							<input
								id="checkout-whatsapp"
								bind:value={whatsapp}
								aria-invalid={errorField === 'whatsapp' || undefined}
								name="whatsapp"
								type="tel"
								inputmode="numeric"
								autocomplete="tel-national"
								placeholder="10 dígitos"
								required
								aria-describedby={errorField === 'whatsapp'
									? 'whatsapp-hint checkout-error'
									: 'whatsapp-hint'}
								class={field}
							/>
						</label>
						<p id="whatsapp-hint" class="text-xs text-muted-foreground">
							Ahí te mandamos la cotización y avisos.
						</p>
					</div>
				</fieldset>

				<fieldset class="flex flex-col gap-3">
					<legend class="mb-2 font-display text-lg">Entrega</legend>
					{#each DELIVERY_METHODS as method (method.value)}
						<label
							class={cn(
								'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm transition-colors',
								metodoEntrega === method.value
									? 'border-gold bg-gold/5'
									: 'border-border hover:border-foreground/40'
							)}
						>
							<input
								type="radio"
								name="metodoEntrega"
								value={method.value}
								bind:group={metodoEntrega}
								class="size-5 accent-gold"
							/>
							<span>
								{method.label}
								<span class="block text-xs text-muted-foreground">
									{method.value === 'recoger'
										? 'Sin costo. Te damos la dirección por WhatsApp.'
										: 'El costo de envío lo cotizamos por WhatsApp.'}
								</span>
							</span>
						</label>
					{/each}
				</fieldset>

				{#if needsAddress}
					<fieldset class="grid gap-4 sm:grid-cols-2">
						<legend class="mb-2 font-display text-lg">Dirección</legend>
						<label class={cn(label, 'sm:col-span-2')}>
							Calle y número
							<input
								id="checkout-calle"
								bind:value={direccion.calle}
								aria-invalid={(errorField === 'direccion' && !direccion.calle.trim()) || undefined}
								autocomplete="address-line1"
								required
								maxlength="120"
								class={field}
							/>
						</label>
						<label class={label}>
							Colonia
							<input
								id="checkout-colonia"
								bind:value={direccion.colonia}
								aria-invalid={(errorField === 'direccion' && !direccion.colonia.trim()) ||
									undefined}
								autocomplete="address-line2"
								required
								maxlength="80"
								class={field}
							/>
						</label>
						<label class={label}>
							Código postal
							<input
								id="checkout-cp"
								bind:value={direccion.cp}
								aria-invalid={(errorField === 'direccion' && !direccion.cp.trim()) || undefined}
								inputmode="numeric"
								autocomplete="postal-code"
								maxlength="5"
								required
								class={field}
							/>
						</label>
						<label class={label}>
							Ciudad
							<input
								id="checkout-ciudad"
								bind:value={direccion.ciudad}
								aria-invalid={(errorField === 'direccion' && !direccion.ciudad.trim()) || undefined}
								autocomplete="address-level2"
								required
								maxlength="80"
								class={field}
							/>
						</label>
						<label class={label}>
							Estado
							<input
								id="checkout-estado"
								bind:value={direccion.estado}
								aria-invalid={(errorField === 'direccion' && !direccion.estado.trim()) || undefined}
								autocomplete="address-level1"
								required
								maxlength="60"
								class={field}
							/>
						</label>
						<label class={cn(label, 'sm:col-span-2')}>
							Referencias (opcional)
							<input
								bind:value={direccion.referencias}
								maxlength="200"
								placeholder="Entre calles, color de la casa…"
								class={field}
							/>
						</label>
					</fieldset>
				{/if}

				<label class={label}>
					<span class="font-display text-lg">Notas (opcional)</span>
					<textarea
						bind:value={notas}
						maxlength="500"
						rows="3"
						placeholder="¿Algo que debamos saber? Fecha en que lo necesitas, etc."
						class="rounded-lg border border-border bg-surface p-3 text-base placeholder:text-muted-foreground focus:border-purple-light"
					></textarea>
				</label>
			</form>

			<div class="flex flex-col gap-4 lg:sticky lg:top-24">
				<ul class="flex flex-col gap-2 text-sm">
					{#each rows as row (row.key)}
						<li class="flex justify-between gap-3">
							<span class="min-w-0">
								{row.line.cantidad}× {row.product?.nombre ?? 'Producto no disponible'}
								<span class="block text-xs text-muted-foreground">
									{[row.colorName, row.line.talla && `Talla ${row.line.talla}`]
										.filter(Boolean)
										.join(' · ')}
								</span>
								{#if row.problem}<span class="block text-xs text-danger">{row.problem}</span>{/if}
							</span>
							{#if row.unitPrice !== null}
								<span class="font-semibold text-gold tabular-nums"
									>{formatMoney(row.unitPrice * row.line.cantidad)}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
				<OrderSummary
					subtotal={quote.ok ? quote.value.subtotal : 0}
					descMayoreo={quote.ok ? quote.value.descMayoreo : 0}
					envio={metodoEntrega === 'recoger' ? 0 : null}
					personalizacion={hasCustomization}
				>
					<div aria-live="polite">
						{#if errorMessage && !errorField}
							<p class="text-sm text-danger" role="alert">{errorMessage}</p>
						{:else if !quote.ok}
							<p class="text-sm text-danger" role="alert">{quote.message}</p>
						{/if}
					</div>
					<button
						type="submit"
						form="checkout"
						disabled={sending || !quote.ok}
						class="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
					>
						{sending ? 'Registrando tu pedido…' : 'Hacer mi pedido'}
					</button>
					<a
						href={resolve('/(store)/carrito')}
						class="inline-flex min-h-11 items-center justify-center text-sm text-purple-light hover:underline"
					>
						Editar carrito
					</a>
				</OrderSummary>
			</div>
		</div>
	{/if}
</div>
