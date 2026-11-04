<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Palette from '@lucide/svelte/icons/palette';
	import Shirt from '@lucide/svelte/icons/shirt';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trophy from '@lucide/svelte/icons/trophy';
	import X from '@lucide/svelte/icons/x';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import Seo from '#lib/components/store/Seo.svelte';
	import SizeBreakdownPicker from '#lib/components/store/SizeBreakdownPicker.svelte';
	import { DatePicker } from '#lib/components/ui/date-picker/index.js';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import { DELIVERY_METHODS, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { MAX_REFERENCE_IMAGES, type SizeBreakdownItem } from '#lib/domain/custom-request.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Archetype: textil (prendas), rigido (artículos / técnicas), otro (libre)
	let archetype = $state<'textil' | 'rigido' | 'otro'>('textil');

	// Textil state
	let selectedGarmentId = $state('');
	const activeGarment = $derived(
		data.garmentOptions.find((g) => g.id === selectedGarmentId) ?? data.garmentOptions[0]
	);

	let selectedColor = $state('');
	let breakdown = $state<SizeBreakdownItem[]>([]);

	$effect(() => {
		if (!selectedGarmentId && data.garmentOptions.length > 0) {
			selectedGarmentId = data.garmentOptions[0].id;
		}
		if (activeGarment && activeGarment.colores.length > 0 && !selectedColor) {
			selectedColor = activeGarment.colores[0].nombre;
		}
		if (activeGarment && activeGarment.tallas.length > 0 && breakdown.length === 0) {
			breakdown = [{ talla: activeGarment.tallas[1] ?? activeGarment.tallas[0], cantidad: 1 }];
		}
	});

	// Rigido / Otros state
	let tipoId = $state('');
	$effect(() => {
		if (!tipoId && data.types.length > 0) {
			tipoId = data.types[0].id;
		}
	});
	let customColor = $state('');
	let otroProductoNombre = $state('');
	let cantidadSimple = $state(1);

	// General form state
	let descripcion = $state('');
	let fechaDeseada = $state('');
	let metodoEntrega = $state<DeliveryMethod>('recoger');
	let nombre = $state('');
	let whatsapp = $state('');
	let calle = $state('');
	let colonia = $state('');
	let cp = $state('');
	let ciudad = $state('');
	let estado = $state('Chiapas');
	let referenciasDomicilio = $state('');

	let sending = $state(false);
	let fileError = $state<string | null>(null);
	let references = $state<{ file: File; url: string }[]>([]);

	const MAX_UPLOAD_TOTAL = 4 * 1024 * 1024;
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
		new Date()
	);

	const DRAFT_KEY = 'ouroboros:encargo_draft';

	// Restore draft on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem(DRAFT_KEY);
				if (saved) {
					const p = JSON.parse(saved);
					if (p.archetype) archetype = p.archetype;
					if (p.selectedGarmentId) selectedGarmentId = p.selectedGarmentId;
					if (p.selectedColor) selectedColor = p.selectedColor;
					if (Array.isArray(p.breakdown) && p.breakdown.length > 0) breakdown = p.breakdown;
					if (p.tipoId) tipoId = p.tipoId;
					if (p.customColor) customColor = p.customColor;
					if (p.otroProductoNombre) otroProductoNombre = p.otroProductoNombre;
					if (p.cantidadSimple) cantidadSimple = p.cantidadSimple;
					if (p.descripcion) descripcion = p.descripcion;
					if (p.fechaDeseada) fechaDeseada = p.fechaDeseada;
					if (p.metodoEntrega) metodoEntrega = p.metodoEntrega;
					if (p.nombre) nombre = p.nombre;
					if (p.whatsapp) whatsapp = p.whatsapp;
					if (p.calle) calle = p.calle;
					if (p.colonia) colonia = p.colonia;
					if (p.cp) cp = p.cp;
					if (p.ciudad) ciudad = p.ciudad;
					if (p.estado) estado = p.estado;
					if (p.referenciasDomicilio) referenciasDomicilio = p.referenciasDomicilio;
				}
			} catch {
				// Ignore parse errors
			}
		}
	});

	// Save draft on state changes
	$effect(() => {
		if (typeof window !== 'undefined' && !form?.placed) {
			try {
				const draft = {
					archetype,
					selectedGarmentId,
					selectedColor,
					breakdown,
					tipoId,
					customColor,
					otroProductoNombre,
					cantidadSimple,
					descripcion,
					fechaDeseada,
					metodoEntrega,
					nombre,
					whatsapp,
					calle,
					colonia,
					cp,
					ciudad,
					estado,
					referenciasDomicilio
				};
				localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
			} catch {
				// Ignore storage errors
			}
		}
	});

	// Clear draft on successful placement
	$effect(() => {
		if (form?.placed && typeof window !== 'undefined') {
			localStorage.removeItem(DRAFT_KEY);
		}
	});

	// Computed summary helpers
	const computedTipoProducto = $derived.by(() => {
		if (archetype === 'textil') return activeGarment?.nombre ?? 'Prenda textil';
		if (archetype === 'rigido') {
			const found = data.types.find((t) => t.id === tipoId);
			return found ? found.nombre : 'Artículo rígido';
		}
		return otroProductoNombre.trim() || 'Encargo personalizado';
	});

	const computedColor = $derived(archetype === 'textil' ? selectedColor : customColor.trim());

	const computedQuantity = $derived.by(() => {
		if (archetype === 'textil') {
			const sum = breakdown.reduce((acc, item) => acc + item.cantidad, 0);
			return sum > 0 ? sum : 1;
		}
		return Math.max(1, cantidadSimple);
	});

	const computedCustomRequestTypeId = $derived.by(() => {
		if (archetype === 'rigido') return tipoId || null;
		return null;
	});

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
			const smaller = await downscaleImage(file, 1600, { keepPng: false });
			references.push({ file: smaller, url: URL.createObjectURL(smaller) });
		}
	}

	function removeReference(index: number) {
		URL.revokeObjectURL(references[index].url);
		references.splice(index, 1);
	}

	const focusOnMount = (node: HTMLElement) => node.focus();

	const field =
		'h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all';
	const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground';
</script>

<Seo
	title="Encargos especiales y personalizados — Ouroboros"
	description="Personaliza tu playera, sudadera, termo, grabado láser o bordado. Elige talla, color, fecha de entrega y te cotizamos por WhatsApp."
/>

<div class="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
	{#if form?.placed}
		<section class="flex flex-col items-center gap-5 text-center">
			<CircleCheck size={56} stroke-width={1.5} class="text-success" />
			<h1 class="text-3xl md:text-4xl" tabindex="-1" {@attach focusOnMount}>
				¡Recibimos tu encargo!
			</h1>
			<div class="rounded-xl border border-gold/40 bg-surface px-6 py-4">
				<p class="text-xs tracking-widest text-muted-foreground uppercase">Tu folio</p>
				<p class="font-display text-3xl text-gold">{form.placed.folio}</p>
			</div>
			<p class="max-w-md text-muted-foreground">
				Mándanos tu encargo por WhatsApp para cotizarlo. Te respondemos con el precio y los tiempos.
			</p>
			<ExternalLink
				href={form.placed.whatsappUrl}
				class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover sm:w-auto"
			>
				<MessageCircle size={20} stroke-width={1.75} />
				Enviar encargo por WhatsApp
			</ExternalLink>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()d path plus the folio query -->
			<a
				href={`${resolve('/(store)/seguimiento')}?folio=${form.placed.folio}`}
				class="inline-flex min-h-11 items-center text-sm text-purple-light hover:underline"
			>
				Seguir mi encargo
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</section>
	{:else}
		<header class="mb-8 flex flex-col gap-3">
			<p class="flex items-center gap-2 text-xs font-medium tracking-[0.3em] text-gold uppercase">
				<Sparkles size={14} stroke-width={1.75} /> Encargos especiales
			</p>
			<h1 class="font-display text-3xl text-foreground md:text-4xl">
				¿Tienes una idea? Hagámosla realidad
			</h1>
			<p class="text-sm text-muted-foreground sm:text-base">
				Elige tu tipo de producto, tallas, color y fecha deseada. Te preparamos tu cotización rápida
				por WhatsApp.
			</p>
		</header>

		<form
			method="POST"
			action="?/enviar"
			enctype="multipart/form-data"
			class="flex flex-col gap-10"
			use:enhance={({ formData, cancel }) => {
				const total = references.reduce((sum, reference) => sum + reference.file.size, 0);
				if (total > MAX_UPLOAD_TOTAL) {
					fileError = 'Tus imágenes pesan demasiado. Quita alguna y mándala por WhatsApp.';
					cancel();
					return;
				}
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
			<!-- Hidden payload inputs for standard form submission -->
			<input type="hidden" name="tipo" value={computedCustomRequestTypeId ?? ''} />
			<input type="hidden" name="tipo_producto" value={computedTipoProducto} />
			<input type="hidden" name="color" value={computedColor} />
			<input
				type="hidden"
				name="desglose_tallas"
				value={archetype === 'textil' ? JSON.stringify(breakdown) : '[]'}
			/>
			<input type="hidden" name="cantidad" value={computedQuantity} />

			<!-- PASO 1: PRODUCTO, COLOR & TALLAS -->
			<fieldset
				class="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-5 shadow-sm md:p-6"
			>
				<legend class="px-1 font-display text-lg font-bold text-foreground">
					1. ¿Qué tipo de producto buscas?
				</legend>

				<!-- Archetype Switcher -->
				<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
					<button
						type="button"
						onclick={() => (archetype = 'textil')}
						class={cn(
							'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
							archetype === 'textil'
								? 'border-gold bg-gold-fill/10 shadow-sm'
								: 'border-border bg-surface hover:border-foreground/40'
						)}
					>
						<div
							class={cn(
								'grid size-10 shrink-0 place-items-center rounded-lg',
								archetype === 'textil'
									? 'bg-gold-fill text-on-gold'
									: 'bg-surface-raised text-muted-foreground'
							)}
						>
							<Shirt size={20} />
						</div>
						<div>
							<span class="block text-sm font-semibold text-foreground">Prenda textil</span>
							<span class="block text-xs text-muted-foreground">Playera, sudadera, etc.</span>
						</div>
					</button>

					<button
						type="button"
						onclick={() => (archetype = 'rigido')}
						class={cn(
							'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
							archetype === 'rigido'
								? 'border-gold bg-gold-fill/10 shadow-sm'
								: 'border-border bg-surface hover:border-foreground/40'
						)}
					>
						<div
							class={cn(
								'grid size-10 shrink-0 place-items-center rounded-lg',
								archetype === 'rigido'
									? 'bg-gold-fill text-on-gold'
									: 'bg-surface-raised text-muted-foreground'
							)}
						>
							<Trophy size={20} />
						</div>
						<div>
							<span class="block text-sm font-semibold text-foreground">Artículo / Técnica</span>
							<span class="block text-xs text-muted-foreground">Termos, grabado, tazas...</span>
						</div>
					</button>

					<button
						type="button"
						onclick={() => (archetype = 'otro')}
						class={cn(
							'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
							archetype === 'otro'
								? 'border-gold bg-gold-fill/10 shadow-sm'
								: 'border-border bg-surface hover:border-foreground/40'
						)}
					>
						<div
							class={cn(
								'grid size-10 shrink-0 place-items-center rounded-lg',
								archetype === 'otro'
									? 'bg-gold-fill text-on-gold'
									: 'bg-surface-raised text-muted-foreground'
							)}
						>
							<Palette size={20} />
						</div>
						<div>
							<span class="block text-sm font-semibold text-foreground">Idea libre</span>
							<span class="block text-xs text-muted-foreground">Cuéntanos tu proyecto</span>
						</div>
					</button>
				</div>

				<!-- Textil Details -->
				{#if archetype === 'textil'}
					<div class="flex flex-col gap-4 border-t border-border/60 pt-4">
						<!-- Garment Base Picker -->
						{#if data.garmentOptions.length > 1}
							<div class="flex flex-col gap-2">
								<span class="text-sm font-semibold text-foreground">Modelo de prenda</span>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{#each data.garmentOptions as option (option.id)}
										<button
											type="button"
											onclick={() => {
												selectedGarmentId = option.id;
												if (option.colores.length > 0) selectedColor = option.colores[0].nombre;
												if (option.tallas.length > 0) {
													breakdown = [
														{ talla: option.tallas[1] ?? option.tallas[0], cantidad: 1 }
													];
												}
											}}
											class={cn(
												'rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-all',
												selectedGarmentId === option.id
													? 'border-gold bg-gold-fill/10 font-semibold text-foreground shadow-sm'
													: 'border-border bg-surface text-muted-foreground hover:border-foreground/40'
											)}
										>
											{option.nombre}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Color Swatches -->
						{#if activeGarment && activeGarment.colores.length > 0}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-foreground">Color de la prenda</span>
									<span class="text-xs text-muted-foreground"
										>Seleccionado: <strong class="text-foreground">{selectedColor}</strong></span
									>
								</div>
								<div class="flex flex-wrap items-center gap-2.5">
									{#each activeGarment.colores as colorItem (colorItem.nombre)}
										<button
											type="button"
											onclick={() => (selectedColor = colorItem.nombre)}
											class={cn(
												'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
												selectedColor === colorItem.nombre
													? 'border-gold bg-surface shadow-sm ring-2 ring-gold/40'
													: 'border-border bg-surface hover:border-foreground/40'
											)}
											aria-label="Color {colorItem.nombre}"
										>
											<span
												class="size-4 shrink-0 rounded-full border border-black/20 shadow-xs"
												style:background-color={colorItem.hex}
											></span>
											<span class="text-foreground">{colorItem.nombre}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Size Breakdown Matrix -->
						{#if activeGarment && activeGarment.tallas.length > 0}
							<SizeBreakdownPicker tallas={activeGarment.tallas} bind:breakdown />
						{/if}
					</div>
				{:else if archetype === 'rigido'}
					<!-- Rigido Details -->
					<div class="flex flex-col gap-4 border-t border-border/60 pt-4">
						{#if data.types.length}
							<div class="flex flex-col gap-2">
								<span class="text-sm font-semibold text-foreground">Técnica o artículo</span>
								<div class="grid gap-2.5 sm:grid-cols-2">
									{#each data.types as type (type.id)}
										<button
											type="button"
											onclick={() => (tipoId = type.id)}
											class={cn(
												'flex items-center justify-between rounded-xl border p-3 text-left transition-all',
												tipoId === type.id
													? 'border-gold bg-gold-fill/10 shadow-sm'
													: 'border-border bg-surface hover:border-foreground/40'
											)}
										>
											<span class="text-sm font-medium text-foreground">{type.nombre}</span>
											<span class="text-xs text-muted-foreground">
												{type.precio_desde !== null
													? `Desde ${formatMoney(type.precio_desde)}`
													: 'Por cotizar'}
											</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<div class="grid gap-4 sm:grid-cols-2">
							<label class={label}>
								Color del artículo (opcional)
								<input
									bind:value={customColor}
									placeholder="Ej. Negro mate, Plateado, Blanco..."
									class={field}
								/>
							</label>

							<label class={label}>
								Cantidad de piezas
								<input type="number" min="1" max="999" bind:value={cantidadSimple} class={field} />
							</label>
						</div>
					</div>
				{:else}
					<!-- Otro Details -->
					<div class="flex flex-col gap-4 border-t border-border/60 pt-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<label class={label}>
								¿Qué producto tienes en mente?
								<input
									bind:value={otroProductoNombre}
									placeholder="Ej. Gorras con parche, Stickers holográficos..."
									class={field}
								/>
							</label>

							<label class={label}>
								Cantidad estimada
								<input type="number" min="1" max="999" bind:value={cantidadSimple} class={field} />
							</label>
						</div>
					</div>
				{/if}
			</fieldset>

			<!-- PASO 2: PERSONALIZACIÓN & REFERENCIAS -->
			<fieldset
				class="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-5 shadow-sm md:p-6"
			>
				<legend class="px-1 font-display text-lg font-bold text-foreground">
					2. Cuéntanos los detalles de tu personalización
				</legend>

				<label class={label}>
					¿Cómo imaginas tu diseño o personalización?
					<textarea
						name="descripcion"
						bind:value={descripcion}
						required
						maxlength="1000"
						rows="4"
						placeholder="Ej. Queremos el logo de nuestra cafetería bordado en el pecho izquierdo, y una frase en la espalda. En colores dorados..."
						class="rounded-xl border border-border bg-surface p-3.5 text-base text-foreground transition-all placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
					></textarea>
				</label>

				<!-- Image References -->
				<div class="flex flex-col gap-2">
					<span class="text-sm font-semibold text-foreground"
						>Imágenes de referencia (opcional)</span
					>
					<p class="text-xs text-muted-foreground">
						Sube hasta {MAX_REFERENCE_IMAGES} imágenes: tu logo en PNG/vector, un boceto o una foto de
						inspiración.
					</p>

					<div class="mt-1 flex flex-wrap gap-3">
						{#each references as reference, i (reference.url)}
							<div
								class="relative size-24 overflow-hidden rounded-xl border border-border shadow-xs"
							>
								<img src={reference.url} alt="Referencia {i + 1}" class="size-full object-cover" />
								<button
									type="button"
									onclick={() => removeReference(i)}
									aria-label="Quitar referencia {i + 1}"
									class="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-xs transition-colors hover:bg-danger hover:text-white"
								>
									<X size={14} />
								</button>
							</div>
						{/each}

						<label
							class={cn(
								'flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition-all hover:border-gold hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring',
								references.length >= MAX_REFERENCE_IMAGES && 'hidden'
							)}
						>
							<ImagePlus size={22} class="text-gold" />
							<span>Subir foto</span>
							<input
								type="file"
								name="referencias"
								accept="image/jpeg,image/png,image/webp"
								multiple
								onchange={addReferences}
								aria-label="Agregar imágenes de referencia"
								class="sr-only"
							/>
						</label>
					</div>
					{#if fileError}<p class="text-xs text-danger" role="alert">{fileError}</p>{/if}
				</div>
			</fieldset>

			<!-- PASO 3: FECHA & ENTREGA & CONTACTO -->
			<fieldset
				class="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-5 shadow-sm md:p-6"
			>
				<legend class="px-1 font-display text-lg font-bold text-foreground">
					3. Fecha de entrega y contacto
				</legend>

				<!-- Date Picker Elegante -->
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-semibold text-foreground"
						>¿Para cuándo lo necesitas? (opcional)</span
					>
					<DatePicker
						name="fecha_deseada"
						bind:value={fechaDeseada}
						min={today}
						placeholder="Elige una fecha estimada o elige un preset..."
					/>
				</div>

				<!-- Contact Data -->
				<div class="grid gap-4 sm:grid-cols-2">
					<label class={label}>
						Tu nombre
						<input
							name="nombre"
							bind:value={nombre}
							autocomplete="name"
							required
							maxlength="80"
							placeholder="Ej. Sofía Morales"
							class={field}
						/>
					</label>

					<div class="flex flex-col gap-1.5">
						<label class={label}>
							WhatsApp
							<input
								name="whatsapp"
								type="tel"
								inputmode="numeric"
								bind:value={whatsapp}
								autocomplete="tel-national"
								placeholder="10 dígitos (ej. 9611234567)"
								required
								class={field}
							/>
						</label>
						<p class="text-xs text-muted-foreground">Ahí te enviaremos la cotización formal.</p>
					</div>
				</div>

				<!-- Delivery Method -->
				<div class="flex flex-col gap-2.5">
					<span class="text-sm font-semibold text-foreground">Método de entrega</span>
					<div class="grid gap-2.5 sm:grid-cols-3">
						{#each DELIVERY_METHODS as method (method.value)}
							<button
								type="button"
								onclick={() => (metodoEntrega = method.value)}
								class={cn(
									'flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all',
									metodoEntrega === method.value
										? 'border-gold bg-gold-fill/10 font-semibold text-foreground shadow-sm'
										: 'border-border bg-surface text-muted-foreground hover:border-foreground/40'
								)}
							>
								<input
									type="radio"
									name="metodoEntrega"
									value={method.value}
									bind:group={metodoEntrega}
									class="size-4 shrink-0 accent-gold"
								/>
								<span>{method.label}</span>
							</button>
						{/each}
					</div>

					{#if metodoEntrega !== 'recoger'}
						<div
							class="mt-3 grid gap-3.5 rounded-xl border border-border/80 bg-surface/50 p-4 sm:grid-cols-2"
						>
							<label class={cn(label, 'sm:col-span-2')}>
								Calle y número
								<input
									name="calle"
									bind:value={calle}
									autocomplete="address-line1"
									required
									maxlength="120"
									placeholder="Calle Central #123"
									class={field}
								/>
							</label>
							<label class={label}>
								Colonia
								<input
									name="colonia"
									bind:value={colonia}
									autocomplete="address-line2"
									required
									maxlength="80"
									placeholder="Centro"
									class={field}
								/>
							</label>
							<label class={label}>
								Código postal
								<input
									name="cp"
									inputmode="numeric"
									bind:value={cp}
									autocomplete="postal-code"
									maxlength="5"
									required
									placeholder="29000"
									class={field}
								/>
							</label>
							<label class={label}>
								Ciudad
								<input
									name="ciudad"
									bind:value={ciudad}
									autocomplete="address-level2"
									required
									maxlength="80"
									placeholder="Tuxtla Gutiérrez"
									class={field}
								/>
							</label>
							<label class={label}>
								Estado
								<input
									name="estado"
									bind:value={estado}
									autocomplete="address-level1"
									required
									maxlength="60"
									class={field}
								/>
							</label>
							<label class={cn(label, 'sm:col-span-2')}>
								Referencias (opcional)
								<input
									name="referencias_domicilio"
									bind:value={referenciasDomicilio}
									maxlength="200"
									placeholder="Portón café, entre 2a y 3a Poniente..."
									class={field}
								/>
							</label>
						</div>
					{/if}
				</div>
			</fieldset>

			<!-- LIVE ORDER SUMMARY CARD -->
			<div
				class="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gold-fill/5 p-4.5 shadow-xs md:p-5"
			>
				<div class="flex items-center gap-2 text-xs font-bold tracking-widest text-gold uppercase">
					<Sparkles size={14} /> Resumen de tu encargo
				</div>
				<div class="flex flex-col gap-1 text-sm text-foreground">
					<p class="text-base font-semibold">
						{computedQuantity}x {computedTipoProducto}
						{#if computedColor}
							<span class="font-normal text-muted-foreground">({computedColor})</span>
						{/if}
					</p>

					{#if archetype === 'textil' && breakdown.length > 0}
						<p class="text-xs text-muted-foreground">
							Tallas: <strong class="text-foreground"
								>{breakdown.map((b) => `${b.cantidad}x ${b.talla}`).join(', ')}</strong
							>
						</p>
					{/if}

					<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						{#if fechaDeseada}
							<span
								>📅 Fecha requerida: <strong class="text-foreground">{fechaDeseada}</strong></span
							>
						{/if}
						<span
							>📦 Entrega: <strong class="text-foreground"
								>{metodoEntrega === 'recoger'
									? 'Recoger en taller (Tuxtla)'
									: 'Envío a domicilio'}</strong
							></span
						>
					</div>
				</div>
			</div>

			<!-- SUBMIT BUTTON & DISCLAIMER -->
			<div class="flex flex-col gap-3">
				<div aria-live="polite">
					{#if form?.message}<p class="text-sm text-danger" role="alert">{form.message}</p>{/if}
				</div>
				<button
					type="submit"
					disabled={sending}
					class="inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
				>
					<Sparkles size={18} stroke-width={1.75} />
					{sending ? 'Registrando tu encargo…' : 'Enviar encargo para cotizar'}
				</button>
				<p class="text-center text-xs text-muted-foreground">
					✨ No pagas nada ahora: revisaremos tus requerimientos y te responderemos por WhatsApp con
					la cotización exacta y opciones de personalización.
				</p>
			</div>
		</form>
	{/if}
</div>
