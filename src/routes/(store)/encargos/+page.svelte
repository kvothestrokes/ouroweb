<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import { DELIVERY_METHODS, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { MAX_REFERENCE_IMAGES } from '#lib/domain/custom-request.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let tipo = $state('');
	let metodoEntrega = $state<DeliveryMethod>('recoger');
	let sending = $state(false);
	let fileError = $state<string | null>(null);
	let references = $state<{ file: File; url: string }[]>([]);
	let fileInput = $state<HTMLInputElement>();

	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
		new Date()
	);

	async function addReferences(event: Event & { currentTarget: HTMLInputElement }) {
		fileError = null;
		const picked = [...(event.currentTarget.files ?? [])];
		event.currentTarget.value = '';
		const room = MAX_REFERENCE_IMAGES - references.length;
		if (picked.length > room) fileError = `Puedes subir hasta ${MAX_REFERENCE_IMAGES} imágenes.`;
		for (const file of picked.slice(0, Math.max(0, room))) {
			if (!file.type.startsWith('image/')) {
				fileError = 'Solo imágenes JPG, PNG o WebP.';
				continue;
			}
			// Phones take huge photos; the server keeps 1600 px anyway (and requests max ~4.5 MB).
			const smaller = await downscaleImage(file, 1600, { keepPng: false });
			references.push({ file: smaller, url: URL.createObjectURL(smaller) });
		}
	}

	function removeReference(index: number) {
		URL.revokeObjectURL(references[index].url);
		references.splice(index, 1);
	}

	const field =
		'h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-purple-light focus:outline-none';
	const label = 'flex flex-col gap-1.5 text-sm';
</script>

<svelte:head>
	<title>Encargos especiales — Ouroboros</title>
	<meta
		name="description"
		content="Cuéntanos tu idea: grabado láser, sublimación, vinil, velas o impresión 3D. Te cotizamos por WhatsApp."
	/>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
	{#if form?.placed}
		<section class="flex flex-col items-center gap-5 text-center">
			<CircleCheck size={56} stroke-width={1.5} class="text-success" />
			<h1 class="text-3xl md:text-4xl">¡Recibimos tu encargo!</h1>
			<div class="rounded-xl border border-gold/40 bg-surface px-6 py-4">
				<p class="text-xs tracking-widest text-muted-foreground uppercase">Tu folio</p>
				<p class="font-display text-3xl text-gold">{form.placed.folio}</p>
			</div>
			<p class="max-w-md text-muted-foreground">
				Mándanos tu encargo por WhatsApp para cotizarlo. Te respondemos con el precio y los tiempos.
			</p>
			<ExternalLink
				href={form.placed.whatsappUrl}
				class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-gold-light sm:w-auto"
			>
				<MessageCircle size={20} stroke-width={1.75} />
				Enviar encargo por WhatsApp
			</ExternalLink>
			<a
				href={resolve('/(store)')}
				class="inline-flex min-h-11 items-center text-sm text-purple-light hover:underline"
			>
				Volver a la tienda
			</a>
		</section>
	{:else}
		<header class="mb-8 flex flex-col gap-3">
			<p class="flex items-center gap-2 text-xs font-medium tracking-[0.3em] text-gold uppercase">
				<Sparkles size={14} stroke-width={1.75} /> Encargos especiales
			</p>
			<h1 class="text-3xl md:text-4xl">¿Tienes una idea? Hagámosla realidad</h1>
			<p class="text-muted-foreground">
				Cuéntanos qué quieres, sube imágenes de referencia si tienes, y te cotizamos por WhatsApp.
			</p>
		</header>

		<form
			method="POST"
			action="?/enviar"
			enctype="multipart/form-data"
			class="flex flex-col gap-10"
			use:enhance={({ formData }) => {
				sending = true;
				formData.delete('referencias');
				for (const reference of references) formData.append('referencias', reference.file);
				return async ({ result, update }) => {
					await update({ reset: false });
					sending = false;
					if (result.type === 'success') {
						for (const reference of references) URL.revokeObjectURL(reference.url);
						references = [];
						window.scrollTo({ top: 0 });
					}
				};
			}}
		>
			<fieldset class="flex flex-col gap-3">
				<legend class="mb-2 font-display text-lg">¿Qué te hacemos?</legend>
				{#if data.types.length}
					<div class="grid gap-3 sm:grid-cols-2">
						{#each data.types as type (type.id)}
							<label
								class={cn(
									'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
									tipo === type.id
										? 'border-gold bg-gold/5'
										: 'border-border hover:border-foreground/40'
								)}
							>
								<input
									type="radio"
									name="tipo"
									value={type.id}
									bind:group={tipo}
									class="size-5 accent-gold"
								/>
								<span>
									{type.nombre}
									<span class="block text-xs text-muted-foreground">
										{type.precio_desde !== null
											? `Desde ${formatMoney(type.precio_desde)}`
											: 'Por cotizar'}
									</span>
								</span>
							</label>
						{/each}
						<label
							class={cn(
								'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
								tipo === '' ? 'border-gold bg-gold/5' : 'border-border hover:border-foreground/40'
							)}
						>
							<input
								type="radio"
								name="tipo"
								value=""
								bind:group={tipo}
								class="size-5 accent-gold"
							/>
							<span>
								Otra cosa
								<span class="block text-xs text-muted-foreground">Cuéntanos en la descripción</span>
							</span>
						</label>
					</div>
				{/if}
				<label class={cn(label, 'mt-2')}>
					Descripción
					<textarea
						name="descripcion"
						required
						maxlength="1000"
						rows="5"
						placeholder="Ej. Un termo negro con el escudo de mi equipo grabado y mi nombre abajo."
						class="rounded-lg border border-border bg-surface p-3 text-base placeholder:text-muted-foreground focus:border-purple-light focus:outline-none"
					></textarea>
				</label>
				<div class="grid gap-4 sm:grid-cols-2">
					<label class={label}>
						Cantidad
						<input
							name="cantidad"
							type="number"
							inputmode="numeric"
							min="1"
							max="999"
							value="1"
							required
							class={field}
						/>
					</label>
					<label class={label}>
						¿Para cuándo lo necesitas? (opcional)
						<input
							name="fecha_deseada"
							type="date"
							min={today}
							class={cn(field, '[color-scheme:dark]')}
						/>
					</label>
				</div>
			</fieldset>

			<fieldset class="flex flex-col gap-3">
				<legend class="mb-1 font-display text-lg">Imágenes de referencia (opcional)</legend>
				<p class="text-sm text-muted-foreground">
					Hasta {MAX_REFERENCE_IMAGES} imágenes: un dibujo, una foto de algo parecido o el logo que quieres.
				</p>
				<div class="flex flex-wrap gap-3">
					{#each references as reference, i (reference.url)}
						<div class="relative size-24 overflow-hidden rounded-lg border border-border">
							<img src={reference.url} alt="Referencia {i + 1}" class="size-full object-cover" />
							<button
								type="button"
								onclick={() => removeReference(i)}
								aria-label="Quitar referencia {i + 1}"
								class="absolute top-0 right-0 grid size-11 place-items-center"
							>
								<span class="grid size-7 place-items-center rounded-full bg-background/80">
									<X size={16} stroke-width={1.75} />
								</span>
							</button>
						</div>
					{/each}
					{#if references.length < MAX_REFERENCE_IMAGES}
						<button
							type="button"
							onclick={() => fileInput?.click()}
							class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-purple-light hover:text-foreground"
						>
							<ImagePlus size={22} stroke-width={1.75} />
							Agregar
						</button>
					{/if}
				</div>
				<!-- Without JavaScript this input is what gets sent. -->
				<input
					bind:this={fileInput}
					type="file"
					name="referencias"
					accept="image/jpeg,image/png,image/webp"
					multiple
					onchange={addReferences}
					class="sr-only"
					tabindex="-1"
					aria-hidden="true"
				/>
				{#if fileError}<p class="text-sm text-danger" role="alert">{fileError}</p>{/if}
			</fieldset>

			<fieldset class="flex flex-col gap-4">
				<legend class="mb-2 font-display text-lg">Tus datos</legend>
				<label class={label}>
					Nombre
					<input name="nombre" autocomplete="name" required maxlength="80" class={field} />
				</label>
				<div class="flex flex-col gap-1.5">
					<label class={label}>
						WhatsApp
						<input
							name="whatsapp"
							type="tel"
							inputmode="numeric"
							autocomplete="tel-national"
							placeholder="10 dígitos"
							required
							aria-describedby="encargo-whatsapp-hint"
							class={field}
						/>
					</label>
					<p id="encargo-whatsapp-hint" class="text-xs text-muted-foreground">
						Ahí te mandamos la cotización.
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
						{method.label}
					</label>
				{/each}
				{#if metodoEntrega !== 'recoger'}
					<div class="mt-2 grid gap-4 sm:grid-cols-2">
						<label class={cn(label, 'sm:col-span-2')}>
							Calle y número
							<input
								name="calle"
								autocomplete="address-line1"
								required
								maxlength="120"
								class={field}
							/>
						</label>
						<label class={label}>
							Colonia
							<input
								name="colonia"
								autocomplete="address-line2"
								required
								maxlength="80"
								class={field}
							/>
						</label>
						<label class={label}>
							Código postal
							<input
								name="cp"
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
								name="ciudad"
								autocomplete="address-level2"
								required
								maxlength="80"
								class={field}
							/>
						</label>
						<label class={label}>
							Estado
							<input
								name="estado"
								autocomplete="address-level1"
								value="Chiapas"
								required
								maxlength="60"
								class={field}
							/>
						</label>
						<label class={cn(label, 'sm:col-span-2')}>
							Referencias (opcional)
							<input
								name="referencias_domicilio"
								maxlength="200"
								placeholder="Entre calles, color de la casa…"
								class={field}
							/>
						</label>
					</div>
				{/if}
			</fieldset>

			<div class="flex flex-col gap-3">
				<div aria-live="polite">
					{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
				</div>
				<button
					type="submit"
					disabled={sending}
					class="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light disabled:opacity-50"
				>
					<Sparkles size={16} stroke-width={1.75} />
					{sending ? 'Enviando tu encargo…' : 'Enviar encargo'}
				</button>
				<p class="text-center text-xs text-muted-foreground">
					No cobramos nada todavía: primero te mandamos la cotización.
				</p>
			</div>
		</form>
	{/if}
</div>
