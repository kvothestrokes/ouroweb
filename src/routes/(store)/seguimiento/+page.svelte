<script lang="ts">
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import PackageSearch from '@lucide/svelte/icons/package-search';
	import Star from '@lucide/svelte/icons/star';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import { deliveryLabel } from '#lib/domain/checkout.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { STATUS_LABELS, type OrderStatus } from '#lib/domain/order-status.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const view = $derived(form && 'view' in form ? form.view : null);
	const digitos = $derived(form && 'digitos' in form ? form.digitos : '');
	let sending = $state(false);
	let rating = $state(0);
	let photoName = $state<string | null>(null);

	const dateTime = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Mexico_City'
	});

	/** The usual path for this order, to show what comes next. */
	const steps = $derived.by((): OrderStatus[] => {
		if (!view) return [];
		const ready: OrderStatus = view.metodoEntrega === 'recoger' ? 'listo_para_recoger' : 'enviado';
		return [
			'pendiente',
			'esperando_anticipo',
			'confirmado',
			'en_produccion',
			'listo',
			ready,
			'entregado'
		];
	});
	const reached = $derived(
		new Map(view?.eventos.map((event) => [event.estado, event.fecha]) ?? [])
	);

	const field =
		'h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground';
	const submitting = () => {
		sending = true;
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			sending = false;
		};
	};
</script>

<svelte:head>
	<title>Sigue tu pedido — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
	<header class="mb-8 flex flex-col gap-2">
		<h1 class="text-3xl md:text-4xl">Sigue tu pedido</h1>
		<p class="text-muted-foreground">
			Escribe tu folio y los últimos 4 dígitos del WhatsApp con el que hiciste el pedido.
		</p>
	</header>

	<form
		method="POST"
		action="?/buscar"
		use:enhance={submitting}
		class="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
	>
		<label class="flex flex-col gap-1.5 text-sm">
			Folio
			<input
				name="folio"
				value={view?.folio ?? (form && 'folio' in form ? form.folio : data.folio)}
				placeholder="OUR-2610-0042"
				autocomplete="off"
				autocapitalize="characters"
				required
				maxlength="14"
				class={cn(field, 'uppercase tabular-nums')}
			/>
		</label>
		<label class="flex flex-col gap-1.5 text-sm">
			Últimos 4 dígitos
			<input
				name="digitos"
				value={digitos}
				inputmode="numeric"
				pattern={'[0-9]{4}'}
				maxlength="4"
				autocomplete="off"
				required
				class={cn(field, 'tabular-nums')}
			/>
		</label>
		<button
			type="submit"
			disabled={sending}
			class="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-gold-light disabled:opacity-50"
		>
			<PackageSearch size={18} stroke-width={1.75} aria-hidden="true" />
			{sending ? 'Buscando…' : 'Buscar'}
		</button>
		<div aria-live="polite" class="sm:col-span-3">
			{#if form && 'message' in form && form.message}
				<p class="text-sm text-danger" role="alert">{form.message}</p>
			{/if}
		</div>
	</form>

	{#if view}
		<section class="mt-8 flex flex-col gap-6" aria-labelledby="pedido">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<h2 id="pedido" class="font-display text-2xl text-gold tabular-nums">{view.folio}</h2>
				<p class="text-sm text-muted-foreground">
					Hola, {view.nombre} · {deliveryLabel(view.metodoEntrega)}
				</p>
			</div>

			{#if view.estado === 'cancelado'}
				<p class="rounded-xl border border-border bg-surface p-4 text-sm">
					Este pedido fue cancelado. Si tienes dudas, escríbenos por WhatsApp.
				</p>
			{:else}
				<ol class="flex flex-col gap-0">
					{#each steps as step, i (step)}
						{@const date = reached.get(step)}
						{@const current = step === view.estado}
						<li class="relative flex gap-4 pb-5 last:pb-0">
							{#if i < steps.length - 1}
								<span
									class={cn(
										'absolute top-7 left-[13px] h-full w-0.5',
										date ? 'bg-gold/60' : 'bg-border'
									)}
									aria-hidden="true"
								></span>
							{/if}
							<span
								class={cn(
									'relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs',
									date
										? 'border-gold bg-gold text-primary-foreground'
										: 'border-border bg-background text-muted-foreground',
									current && 'ring-4 ring-gold/25'
								)}
							>
								{#if date}<Check size={14} stroke-width={2} aria-hidden="true" />{:else}{i + 1}{/if}
							</span>
							<div class="pt-0.5">
								<p
									class={cn(
										'text-sm',
										date ? 'text-foreground' : 'text-muted-foreground',
										current && 'font-semibold'
									)}
								>
									{STATUS_LABELS[step]}
									{#if current}<span class="sr-only">(estado actual)</span>{/if}
								</p>
								{#if date}<p class="text-xs text-muted-foreground">
										{dateTime.format(new Date(date))}
									</p>{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}

			{#if view.guia}
				<p class="rounded-xl border border-gold/40 bg-surface p-4 text-sm">
					Guía de paquetería: <span class="font-semibold tabular-nums">{view.guia}</span>
				</p>
			{/if}

			<div class="rounded-2xl border border-border bg-surface p-5">
				{#if view.encargo}
					<p class="text-sm whitespace-pre-line">{view.encargo}</p>
				{:else}
					<ul class="flex flex-col gap-2 text-sm">
						{#each view.lineas as line, i (i)}
							<li class="flex justify-between gap-4">
								<span>
									{line.cantidad}× {line.nombre}
									{#if line.detalle}<span class="block text-xs text-muted-foreground"
											>{line.detalle}</span
										>{/if}
								</span>
								<span class="tabular-nums">{formatMoney(line.importe)}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<dl class="mt-4 grid grid-cols-2 gap-1 border-t border-border pt-4 text-sm">
					<dt class="text-muted-foreground">{view.porCotizar ? 'Total estimado' : 'Total'}</dt>
					<dd class="text-right font-semibold text-gold tabular-nums">
						{view.total ? formatMoney(view.total) : 'Por cotizar'}
					</dd>
					<dt class="text-muted-foreground">Pagado</dt>
					<dd class="text-right tabular-nums">{formatMoney(view.pagado)}</dd>
					{#if view.total}
						<dt class="text-muted-foreground">Saldo</dt>
						<dd class="text-right tabular-nums">{formatMoney(Math.max(0, view.saldo))}</dd>
					{/if}
				</dl>
			</div>

			{#if form && 'reviewed' in form && form.reviewed}
				<p
					class="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success"
					role="status"
				>
					¡Gracias por tu reseña! La publicaremos después de revisarla.
				</p>
			{:else if view.resenaEnviada}
				<p class="text-sm text-muted-foreground">Ya recibimos tu reseña. ¡Gracias!</p>
			{:else if view.puedeResenar}
				<form
					method="POST"
					action="?/resena"
					enctype="multipart/form-data"
					use:enhance={async ({ formData }) => {
						const photo = formData.get('foto');
						if (photo instanceof File && photo.size > 0) {
							formData.set('foto', await downscaleImage(photo, 1600, { keepPng: false }));
						}
						return submitting();
					}}
					class="flex flex-col gap-4 rounded-2xl border border-gold/40 bg-surface p-5"
				>
					<h3 class="text-xl">¿Qué te pareció?</h3>
					<input type="hidden" name="folio" value={view.folio} />
					<input type="hidden" name="digitos" value={digitos} />
					<fieldset>
						<legend class="mb-2 text-sm">Calificación</legend>
						<div class="flex gap-1">
							{#each [1, 2, 3, 4, 5] as value (value)}
								<label
									class="grid size-11 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-ring"
								>
									<input
										type="radio"
										name="calificacion"
										{value}
										bind:group={rating}
										required
										class="sr-only"
									/>
									<Star
										size={28}
										stroke-width={1.5}
										class={value <= rating ? 'fill-gold text-gold' : 'text-muted-foreground'}
										aria-hidden="true"
									/>
									<span class="sr-only">{value} {value === 1 ? 'estrella' : 'estrellas'}</span>
								</label>
							{/each}
						</div>
					</fieldset>
					<label class="flex flex-col gap-1.5 text-sm">
						Cuéntanos (opcional)
						<textarea
							name="texto"
							rows="3"
							maxlength="600"
							class="rounded-lg border border-border bg-background p-3 text-base"></textarea>
					</label>
					<label
						class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-purple-light hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring"
					>
						<ImagePlus size={18} stroke-width={1.75} aria-hidden="true" />
						<span class="truncate">{photoName ?? 'Agrega una foto de tu pedido (opcional)'}</span>
						<input
							type="file"
							name="foto"
							accept="image/jpeg,image/png,image/webp"
							onchange={(event) => (photoName = event.currentTarget.files?.[0]?.name ?? null)}
							class="sr-only"
						/>
					</label>
					<div aria-live="polite">
						{#if form && 'reviewMessage' in form && form.reviewMessage}
							<p class="text-sm text-danger" role="alert">{form.reviewMessage}</p>
						{/if}
					</div>
					<button
						type="submit"
						disabled={sending}
						class="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-gold-light disabled:opacity-50"
					>
						{sending ? 'Enviando…' : 'Enviar reseña'}
					</button>
				</form>
			{/if}
		</section>
	{/if}
</div>
