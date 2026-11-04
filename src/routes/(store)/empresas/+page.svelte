<script lang="ts">
	import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Calculator from '@lucide/svelte/icons/calculator';
	import Camera from '@lucide/svelte/icons/camera';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import Copy from '@lucide/svelte/icons/copy';
	import Eye from '@lucide/svelte/icons/eye';
	import Gift from '@lucide/svelte/icons/gift';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Layers from '@lucide/svelte/icons/layers';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Shirt from '@lucide/svelte/icons/shirt';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import ProtectedImage from '#lib/components/store/ProtectedImage.svelte';
	import Seo from '#lib/components/store/Seo.svelte';
	import { classifyLeadTime, simulateVolumePricing } from '#lib/domain/b2b.js';
	import { DELIVERY_METHODS, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { MAX_REFERENCE_IMAGES } from '#lib/domain/custom-request.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { whatsappLink } from '#lib/domain/whatsapp.js';
	import { cn } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const initialPack = $derived(
		data.packages.find((p) => p.slug === data.prospect.packSlug) ?? data.packages[0]
	);

	const hasPreloadedMockups = $derived(Boolean(data.prospect.logoUrl));

	// Simulator state
	let selectedLineId = $state('');
	const activeLine = $derived(
		data.settings.escalas_simulador.find((l) => l.id === selectedLineId) ??
			data.settings.escalas_simulador[0]
	);
	let simQty = $state(25);
	const simulation = $derived(activeLine ? simulateVolumePricing(activeLine, simQty) : null);

	// Logo previewer state (Endowment Effect) & shared reference files
	let previewSurface = $state<'dark' | 'light' | 'laser'>('dark');
	let logoScale = $state<'sm' | 'md' | 'lg'>('md');
	let references = $state<{ file: File; url: string }[]>([]);
	let fileError = $state<string | null>(null);
	let activeSection = $state<string>('inicio');

	// Active logo shown in "Visualiza tu identidad" (user upload overrides admin preloaded logo)
	const activeLogoUrl = $derived(references[0]?.url ?? data.prospect.logoUrl ?? null);

	// Quote form state (pre-filled from personalized URL or simulator/package selection)
	let empresa = $state('');
	let nombre = $state('');
	let solucion = $state('');
	let cantidad = $state(25);
	let fechaDeseada = $state('');
	let metodoEntrega = $state<DeliveryMethod>('recoger');
	let sending = $state(false);
	let copiedFolio = $state(false);

	$effect(() => {
		if (!empresa && data.prospect.empresa) empresa = data.prospect.empresa;
		if (!nombre && data.prospect.contacto) nombre = data.prospect.contacto;
		if (!solucion && initialPack) {
			solucion = initialPack.nombre;
			cantidad = Math.max(initialPack.cantidad_minima, 15);
		}
	});

	$effect(() => {
		if (data.prospect.logoFondoSugerido === 'light') {
			previewSurface = 'light';
		} else {
			previewSurface = 'dark';
		}
	});

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		const ids = ['identidad', 'portafolio', 'garantias', 'simulador', 'soluciones', 'cotizador'];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
						break;
					}
				}
			},
			{ rootMargin: '-20% 0px -65% 0px', threshold: 0.05 }
		);
		for (const id of ids) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});

	const navItems = $derived.by(() => {
		const items = [
			{
				id: 'identidad',
				label: hasPreloadedMockups ? 'Tus Mockups' : 'Visualiza tu Identidad',
				icon: Eye
			},
			{ id: 'portafolio', label: 'Muestras de Taller', icon: Camera },
			{ id: 'garantias', label: 'Garantías', icon: ShieldCheck },
			{ id: 'simulador', label: 'Simulador de Ahorro', icon: Calculator },
			{ id: 'soluciones', label: 'Paquetes Corporativos', icon: PackageCheck }
		];
		if (!hasPreloadedMockups) {
			// When not preloaded, Muestras de Taller comes before Visualiza tu Identidad
			return [items[1], items[0], items[2], items[3], items[4]];
		}
		return items;
	});

	const leadTime = $derived(classifyLeadTime(fechaDeseada || null));

	const MAX_UPLOAD_TOTAL = 4 * 1024 * 1024;
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
		new Date()
	);

	const directWhatsappHref = $derived.by(() => {
		const intro = data.prospect.empresa
			? `¡Hola! Te escribo de *${data.prospect.empresa}*. Vi nuestra propuesta corporativa personalizada y me interesa cotizar un pedido empresarial.`
			: '¡Hola! Vi la sección de Empresas y me gustaría cotizar un pedido corporativo / mayoreo.';
		return whatsappLink(PUBLIC_WHATSAPP_NUMBER, intro);
	});

	async function addReferences(event: Event & { currentTarget: HTMLInputElement }) {
		fileError = null;
		const picked = [...(event.currentTarget.files ?? [])];
		event.currentTarget.value = '';
		const room = MAX_REFERENCE_IMAGES - references.length;
		if (picked.length > room) {
			fileError = `Puedes adjuntar hasta ${MAX_REFERENCE_IMAGES} archivos de logo o referencia.`;
		}
		for (const file of picked.slice(0, Math.max(0, room))) {
			if (!file.type.startsWith('image/')) {
				fileError = 'Usa imágenes en formato PNG, JPG o WebP.';
				continue;
			}
			const smaller = await downscaleImage(file, 1600, { keepPng: true });
			references.push({ file: smaller, url: URL.createObjectURL(smaller) });
		}
	}

	function removeReference(index: number) {
		URL.revokeObjectURL(references[index].url);
		references.splice(index, 1);
	}

	function selectPackageForQuote(packNombre: string, minQty: number) {
		solucion = packNombre;
		if (cantidad < minQty) cantidad = minQty;
		document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
	}

	function transferSimulationToQuote() {
		if (!activeLine || !simulation) return;
		solucion = activeLine.nombre;
		cantidad = simulation.cantidad;
		document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
	}

	function scrollToSection(id: string) {
		activeSection = id;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}

	async function copyFolio(folio: string) {
		try {
			await navigator.clipboard.writeText(folio);
			copiedFolio = true;
			setTimeout(() => (copiedFolio = false), 2500);
		} catch {
			// Fallback: user can still read and select the folio text.
		}
	}

	const focusOnMount = (node: HTMLElement) => node.focus();

	const field =
		'h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-purple-light';
	const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground';
	const QUICK_QTYS = [10, 25, 50, 100] as const;

	const logoSizeClass = $derived(
		logoScale === 'sm'
			? 'max-h-14 max-w-[110px]'
			: logoScale === 'lg'
				? 'max-h-28 max-w-[200px]'
				: 'max-h-20 max-w-[155px]'
	);
</script>

<Seo
	title={data.prospect.empresa
		? `Propuesta para ${data.prospect.empresa} — Ouroboros Empresas`
		: 'Empresas y Mayoreo — Uniformes, Termos Láser y Kits Corporativos | Ouroboros'}
	description={data.settings.hero_subtitulo}
/>

{#snippet mockupStudioSection(isTopPriority: boolean)}
	<section
		id="identidad"
		class={cn(
			'scroll-mt-28',
			isTopPriority
				? 'border-b border-border bg-background py-10 md:py-14'
				: 'border-b border-border bg-surface py-14 md:py-20'
		)}
	>
		<div class="mx-auto max-w-7xl px-4 md:px-6">
			<div class="rounded-2xl border border-gold/40 bg-card p-6 shadow-sm md:p-8 lg:p-10">
				<!-- Studio Header & Reordered Control Bar -->
				<div
					class="flex flex-col justify-between gap-6 border-b border-border pb-6 lg:flex-row lg:items-end"
				>
					<div class="max-w-2xl">
						<div
							class="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-gold uppercase"
						>
							<Sparkles size={15} />
							{data.prospect.empresa
								? `Visualiza la identidad de ${data.prospect.empresa}`
								: 'Visualiza tu identidad en segundos'}
						</div>
						<h2 class="mt-2 font-display text-2xl font-bold text-foreground md:text-4xl">
							{#if data.prospect.empresa && activeLogoUrl}
								Mockups preparados para <span class="text-gold">{data.prospect.empresa}</span>
							{:else if data.prospect.empresa}
								Prueba cómo luce el logotipo de <span class="text-gold"
									>{data.prospect.empresa}</span
								>
							{:else}
								Prueba cómo luce tu logotipo en nuestras líneas de taller
							{/if}
						</h2>
						<p class="mt-2 text-sm text-muted-foreground">
							{#if data.prospect.logoUrl && references.length === 0}
								Precargamos el logotipo de <strong class="text-foreground"
									>{data.prospect.empresa}</strong
								>
								para que explores el contraste en textil, grabado láser y kits de bienvenida. También
								puedes subir otra versión de tu logo.
							{:else}
								Selecciona tu logotipo en PNG, WebP o JPG para previsualizarlo al instante en
								prendas, termos láser y kits. Tu archivo quedará adjunto automáticamente a tu
								cotización.
							{/if}
						</p>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<label
							for="logo-preview-upload"
							class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-gold/60 bg-surface px-4 text-xs font-semibold text-foreground transition-colors hover:border-gold hover:bg-surface-raised"
						>
							<ImagePlus size={16} class="text-gold" />
							{activeLogoUrl ? 'Probar o subir otro logotipo' : 'Subir logotipo de mi empresa'}
						</label>
						<input
							id="logo-preview-upload"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							onchange={addReferences}
							class="sr-only"
						/>
						<a
							href="#cotizador"
							class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
						>
							Solicitar muestra oficial
							<ArrowRight size={14} />
						</a>
					</div>
				</div>

				<!-- Interactive Controls: Contrast Surface & Logo Scale -->
				<div
					class="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-4 lg:flex-row lg:items-center"
				>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							1. Superficie y técnica:
						</span>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								onclick={() => (previewSurface = 'dark')}
								class={cn(
									'min-h-10 rounded-md border px-3.5 text-xs font-semibold transition-colors',
									previewSurface === 'dark'
										? 'border-gold bg-primary text-primary-foreground'
										: 'border-border bg-card text-muted-foreground hover:text-foreground'
								)}
							>
								Fondo oscuro (Prenda negra / Termo mate)
							</button>
							<button
								type="button"
								onclick={() => (previewSurface = 'light')}
								class={cn(
									'min-h-10 rounded-md border px-3.5 text-xs font-semibold transition-colors',
									previewSurface === 'light'
										? 'border-gold bg-primary text-primary-foreground'
										: 'border-border bg-card text-muted-foreground hover:text-foreground'
								)}
							>
								Fondo claro (Prenda blanca / Cerámica)
							</button>
							<button
								type="button"
								onclick={() => (previewSurface = 'laser')}
								class={cn(
									'min-h-10 rounded-md border px-3.5 text-xs font-semibold transition-colors',
									previewSurface === 'laser'
										? 'border-gold bg-primary text-primary-foreground'
										: 'border-border bg-card text-muted-foreground hover:text-foreground'
								)}
							>
								Simulación grabado láser / Acero
							</button>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							2. Escala:
						</span>
						<div class="inline-flex rounded-md border border-border bg-card p-1">
							<button
								type="button"
								onclick={() => (logoScale = 'sm')}
								class={cn(
									'rounded px-2.5 py-1.5 text-xs font-semibold transition-colors',
									logoScale === 'sm'
										? 'bg-gold-fill text-on-gold'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								Pecho / Discreto
							</button>
							<button
								type="button"
								onclick={() => (logoScale = 'md')}
								class={cn(
									'rounded px-2.5 py-1.5 text-xs font-semibold transition-colors',
									logoScale === 'md'
										? 'bg-gold-fill text-on-gold'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								Estándar
							</button>
							<button
								type="button"
								onclick={() => (logoScale = 'lg')}
								class={cn(
									'rounded px-2.5 py-1.5 text-xs font-semibold transition-colors',
									logoScale === 'lg'
										? 'bg-gold-fill text-on-gold'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								Frontal amplio
							</button>
						</div>
					</div>
				</div>

				<!-- 3-Card Multi-Surface Mockup Grid -->
				<div class="mt-6 grid gap-5 lg:grid-cols-3">
					<!-- Mockup 1: Corporate Apparel -->
					<div
						class="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface"
					>
						<div
							class={cn(
								'relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden p-6 transition-colors',
								previewSurface === 'light'
									? 'bg-card text-foreground'
									: 'dark bg-background text-foreground'
							)}
						>
							<span
								class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-overlay px-3 py-1 text-[11px] font-medium text-overlay-foreground"
							>
								<Shirt size={13} class="text-gold" /> Uniforme / Textil pesado
							</span>

							{#if activeLogoUrl}
								<!-- Stylized Garment Collar & Chest Frame -->
								<div
									class="relative flex size-full flex-col items-center justify-center rounded-xl border border-dashed border-gold/30 p-4"
								>
									<div
										class="mb-2 h-3 w-16 rounded-b-full border-x border-b border-border/70 opacity-60"
									></div>
									<img
										src={activeLogoUrl}
										alt="Mockup textil para {data.prospect.empresa ?? 'tu empresa'}"
										class={cn(
											'object-contain transition-all duration-200',
											logoSizeClass,
											previewSurface === 'laser'
												? ' contrast-125 grayscale invert'
												: 'drop-shadow-md'
										)}
									/>
								</div>
							{:else}
								<label
									for="logo-preview-upload"
									class="flex cursor-pointer flex-col items-center gap-2 text-center"
								>
									<div
										class="grid size-12 place-items-center rounded-full border border-dashed border-gold/60 text-gold"
									>
										<ImagePlus size={20} />
									</div>
									<span class="text-xs font-semibold"
										>Sube tu logo para ver en playera / sudadera</span
									>
								</label>
							{/if}
						</div>
						<div class="flex items-center justify-between border-t border-border p-4">
							<div>
								<p class="font-display text-sm font-bold text-foreground">
									Playeras, Polos y Sudaderas
								</p>
								<p class="text-xs text-muted-foreground">
									Estampado de alta durabilidad · Mezcla libre de tallas
								</p>
							</div>
							<span
								class="rounded-md bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-gold"
							>
								Textil
							</span>
						</div>
					</div>

					<!-- Mockup 2: Laser-Engraved Tumbler -->
					<div
						class="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface"
					>
						<div
							class={cn(
								'relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden p-6 transition-colors',
								previewSurface === 'light'
									? 'bg-card text-foreground'
									: 'dark bg-background text-foreground'
							)}
						>
							<span
								class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-overlay px-3 py-1 text-[11px] font-medium text-overlay-foreground"
							>
								<Layers size={13} class="text-gold" /> Grabado láser en acero
							</span>

							{#if activeLogoUrl}
								<!-- Stylized Tumbler Cylinder Silhouette -->
								<div
									class="relative flex h-full w-40 flex-col items-center justify-center rounded-2xl border-x-2 border-t-4 border-b-2 border-gold/40 bg-surface-raised/25 px-4 py-3 shadow-inner"
								>
									<img
										src={activeLogoUrl}
										alt="Mockup termo láser para {data.prospect.empresa ?? 'tu empresa'}"
										class={cn(
											'object-contain transition-all duration-200',
											logoSizeClass,
											previewSurface === 'laser'
												? 'opacity-90 contrast-150 grayscale invert'
												: 'drop-shadow-md'
										)}
									/>
								</div>
							{:else}
								<label
									for="logo-preview-upload"
									class="flex cursor-pointer flex-col items-center gap-2 text-center"
								>
									<div
										class="grid size-12 place-items-center rounded-full border border-dashed border-gold/60 text-gold"
									>
										<ImagePlus size={20} />
									</div>
									<span class="text-xs font-semibold">Sube tu logo para ver en termo láser</span>
								</label>
							{/if}
						</div>
						<div class="flex items-center justify-between border-t border-border p-4">
							<div>
								<p class="font-display text-sm font-bold text-foreground">
									Termos y Cilindros Ejecutivos
								</p>
								<p class="text-xs text-muted-foreground">
									Grabado láser permanente que nunca se despinta
								</p>
							</div>
							<span
								class="rounded-md bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-gold"
							>
								Láser
							</span>
						</div>
					</div>

					<!-- Mockup 3: Corporate Onboarding Kit / Mug & Box -->
					<div
						class="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface"
					>
						<div
							class={cn(
								'relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden p-6 transition-colors',
								previewSurface === 'light'
									? 'bg-card text-foreground'
									: 'dark bg-background text-foreground'
							)}
						>
							<span
								class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-overlay px-3 py-1 text-[11px] font-medium text-overlay-foreground"
							>
								<Gift size={13} class="text-gold" /> Kit bienvenida y promocionales
							</span>

							{#if activeLogoUrl}
								<div
									class="relative flex size-full flex-col items-center justify-center rounded-xl border border-gold/30 bg-surface-raised/15 p-4"
								>
									<img
										src={activeLogoUrl}
										alt="Mockup kit corporativo para {data.prospect.empresa ?? 'tu empresa'}"
										class={cn('object-contain transition-all duration-200', logoSizeClass)}
									/>
									<span
										class="mt-3 rounded-full border border-gold/30 bg-overlay px-2.5 py-0.5 text-[10px] font-semibold text-gold"
									>
										{data.prospect.empresa ?? 'Identidad Corporativa'}
									</span>
								</div>
							{:else}
								<label
									for="logo-preview-upload"
									class="flex cursor-pointer flex-col items-center gap-2 text-center"
								>
									<div
										class="grid size-12 place-items-center rounded-full border border-dashed border-gold/60 text-gold"
									>
										<ImagePlus size={20} />
									</div>
									<span class="text-xs font-semibold">Sube tu logo para ver en kit / taza</span>
								</label>
							{/if}
						</div>
						<div class="flex items-center justify-between border-t border-border p-4">
							<div>
								<p class="font-display text-sm font-bold text-foreground">
									Kits de Onboarding, Tazas y 3D
								</p>
								<p class="text-xs text-muted-foreground">
									Presentación lista para entregar a tu equipo o clientes
								</p>
							</div>
							<span
								class="rounded-md bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-gold"
							>
								Kits VIP
							</span>
						</div>
					</div>
				</div>

				<!-- Footer note inside Mockup Studio -->
				<div
					class="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground"
				>
					<span>
						✨ Vista conceptual interactiva: antes de producir tu lote, nuestro taller prepara la
						<strong class="text-foreground">muestra digital definitiva sin costo</strong> cuidando proporción,
						color y corte.
					</span>
					{#if references.length > 0}
						<span class="font-semibold text-success">
							✓ {references.length}
							{references.length === 1
								? 'archivo adjunto a tu solicitud'
								: 'archivos adjuntos a tu solicitud'}
						</span>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/snippet}

{#if form?.placed}
	<div class="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-20">
		<section
			class="flex flex-col items-center gap-6 rounded-2xl border border-gold/40 bg-card p-8 text-center shadow-sm md:p-12"
		>
			<CircleCheck size={56} stroke-width={1.5} class="text-success" />
			<p class="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
				Solicitud Corporativa Registrada
			</p>
			<h1 class="font-display text-3xl md:text-4xl" tabindex="-1" {@attach focusOnMount}>
				¡Listo{form.empresa ? `, ${form.empresa}` : ''}!
			</h1>
			<p class="max-w-lg text-muted-foreground">
				Generamos un folio único para tu empresa. Con él puedes consultar el avance o compartirlo
				con tu equipo de compras.
			</p>

			<div
				class="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border bg-surface px-6 py-4"
			>
				<div class="text-left">
					<p class="text-[11px] tracking-widest text-muted-foreground uppercase">
						Folio empresarial
					</p>
					<p class="font-display text-3xl text-gold">{form.placed.folio}</p>
				</div>
				<button
					type="button"
					onclick={() => form?.placed && copyFolio(form.placed.folio)}
					class="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-raised px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-gold"
				>
					{#if copiedFolio}
						<Check size={16} class="text-success" /> Copiado
					{:else}
						<Copy size={16} /> Copiar folio
					{/if}
				</button>
			</div>

			<div class="flex w-full flex-col justify-center gap-3 pt-2 sm:flex-row">
				<ExternalLink
					href={form.placed.whatsappUrl}
					class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
				>
					<MessageCircle size={20} stroke-width={1.75} />
					Confirmar cotización y mockup por WhatsApp
				</ExternalLink>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`${resolve('/(store)/seguimiento')}?folio=${form.placed.folio}`}
					class="inline-flex min-h-12 items-center justify-center rounded-md border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
				>
					Ver seguimiento del pedido
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</section>
	</div>
{:else}
	<!-- Sticky Visual Submenu (Quick Navigation & Trust Bar) -->
	<nav
		aria-label="Secciones de empresas"
		class="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md"
	>
		<div
			class="mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-x-auto px-4 py-2.5 md:px-6"
		>
			<div class="flex items-center gap-1.5">
				{#if data.prospect.empresa}
					<span
						class="mr-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold-fill/15 px-3 py-1.5 text-xs font-bold text-gold"
					>
						<Sparkles size={13} />
						{data.prospect.empresa}
					</span>
				{/if}

				{#each navItems as item (item.id)}
					{@const Icon = item.icon}
					<button
						type="button"
						onclick={() => scrollToSection(item.id)}
						class={cn(
							'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
							activeSection === item.id
								? 'border-gold bg-accent/25 text-foreground'
								: 'border-transparent bg-surface text-muted-foreground hover:border-border hover:text-foreground'
						)}
					>
						<Icon size={14} class="text-gold" />
						<span>{item.label}</span>
					</button>
				{/each}
			</div>

			<button
				type="button"
				onclick={() => scrollToSection('cotizador')}
				class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-gold-fill px-4 py-1.5 text-xs font-bold text-on-gold transition-opacity hover:opacity-90"
			>
				Cotizar ahora
				<ArrowRight size={13} />
			</button>
		</div>
	</nav>

	<!-- WHEN PERSONALIZED LINK HAS PRELOADED MOCKUPS: Render Mockups & Giant Company Name FIRST at the very top -->
	{#if hasPreloadedMockups}
		<section id="inicio" class="border-b border-border bg-surface">
			<div class="mx-auto max-w-7xl px-4 pt-8 pb-6 md:px-6 lg:pt-12">
				<div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<div>
						<div
							class="inline-flex flex-wrap items-center gap-2 rounded-full border border-gold/40 bg-gold-fill/15 px-4 py-1.5 text-xs font-semibold text-foreground"
						>
							<Sparkles size={14} class="text-gold" />
							<span>
								Propuesta corporativa exclusiva{data.prospect.contacto
									? ` · Hola, ${data.prospect.contacto}`
									: ''}
							</span>
						</div>
						<h1
							class="mt-3 font-display text-4xl leading-[1.02] font-bold tracking-tight text-gold sm:text-6xl"
						>
							{data.prospect.empresa}
						</h1>
						<p class="mt-2 max-w-2xl text-base font-medium text-foreground md:text-lg">
							{data.settings.hero_titulo}
						</p>
						{#if data.prospect.nota}
							<p
								class="mt-3 max-w-2xl rounded-xl border border-gold/30 bg-card px-4 py-2.5 text-sm text-muted-foreground"
							>
								«{data.prospect.nota}»
							</p>
						{/if}
					</div>

					<!-- Top CTA Buttons including Muestras Reales de Taller -->
					<div class="flex flex-wrap items-center gap-3">
						<a
							href="#portafolio"
							class="inline-flex min-h-12 items-center gap-2 rounded-md border border-gold/60 bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:border-gold hover:bg-surface-raised"
						>
							<Camera size={17} class="text-gold" />
							Muestras reales de taller · Trabajos entregados
						</a>
						<a
							href="#cotizador"
							class="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
						>
							Solicitar cotización para {data.prospect.empresa}
							<ArrowRight size={16} stroke-width={2} />
						</a>
						<ExternalLink
							href={directWhatsappHref}
							class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
						>
							<MessageCircle size={18} stroke-width={1.75} class="text-gold" />
							WhatsApp directo
						</ExternalLink>
					</div>
				</div>
			</div>
		</section>

		<!-- 1st Visual Block: Preloaded Mockups right at the top -->
		{@render mockupStudioSection(true)}
	{:else}
		<!-- 1. Personalized Editorial Hero + Trust Bar -->
		<section id="inicio" class="border-b border-border bg-surface">
			<div class="mx-auto max-w-7xl px-4 pt-8 pb-12 md:px-6 lg:pt-14 lg:pb-16">
				{#if data.prospect.empresa}
					<div
						class="mb-4 inline-flex flex-wrap items-center gap-2.5 rounded-full border border-gold/40 bg-gold-fill/15 px-4 py-2 text-xs font-semibold text-foreground"
					>
						<Sparkles size={15} class="text-gold" />
						<span>
							Propuesta corporativa preparada en exclusiva{data.prospect.contacto
								? ` · Hola, ${data.prospect.contacto}`
								: ''}
						</span>
					</div>
				{/if}

				<div class="grid items-center gap-10 lg:grid-cols-[1.18fr_0.82fr]">
					<div class="flex flex-col items-start gap-5">
						<p
							class="border-l-2 border-gold pl-3 text-xs font-semibold tracking-[0.2em] text-gold uppercase"
						>
							{data.settings.badge_texto}
						</p>

						{#if data.prospect.empresa}
							<div>
								<h1
									class="font-display text-4xl leading-[1.03] font-bold tracking-tight text-gold sm:text-6xl"
								>
									{data.prospect.empresa}
								</h1>
								<p
									class="mt-3 font-display text-xl leading-snug font-semibold text-foreground sm:text-2xl"
								>
									{data.settings.hero_titulo}
								</p>
							</div>
						{:else}
							<h1
								class="font-display text-3xl leading-[1.05] font-bold tracking-tight text-foreground sm:text-5xl"
							>
								{data.settings.hero_titulo}
							</h1>
						{/if}

						<p class="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
							{data.settings.hero_subtitulo}
						</p>

						{#if data.prospect.nota}
							<div
								class="w-full max-w-xl rounded-xl border border-gold/35 bg-card p-4 text-sm text-foreground"
							>
								<p class="text-[11px] font-semibold tracking-wider text-gold uppercase">
									Nota preparada para {data.prospect.empresa}
								</p>
								<p class="mt-1 text-muted-foreground">«{data.prospect.nota}»</p>
							</div>
						{/if}

						<div class="flex flex-wrap items-center gap-3 pt-2">
							<a
								href="#cotizador"
								class="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
							>
								{data.prospect.empresa
									? `Solicitar propuesta para ${data.prospect.empresa}`
									: 'Solicitar cotización y mockup sin costo'}
								<ArrowRight size={16} stroke-width={2} />
							</a>
							<a
								href="#portafolio"
								class="inline-flex min-h-12 items-center gap-2 rounded-md border border-gold/60 bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:border-gold hover:bg-surface-raised"
							>
								<Camera size={17} class="text-gold" />
								Muestras reales de taller · Trabajos entregados
							</a>
							<ExternalLink
								href={directWhatsappHref}
								class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
							>
								<MessageCircle size={18} stroke-width={1.75} class="text-gold" />
								Hablar directo por WhatsApp
							</ExternalLink>
						</div>
					</div>

					<!-- Value Proposition & Risk Reversal Summary Card -->
					<div class="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
						<div class="flex items-center gap-3 border-b border-border pb-4">
							<div class="grid size-11 place-items-center rounded-lg bg-gold-fill text-on-gold">
								<Building2 size={22} stroke-width={1.75} />
							</div>
							<div>
								<p class="font-display text-lg font-bold text-foreground">
									{data.prospect.empresa
										? `Respaldo para ${data.prospect.empresa}`
										: 'Respaldo para compras empresariales'}
								</p>
								<p class="text-xs text-muted-foreground">
									Sin intermediarios: trato directo con nuestro taller en Chiapas
								</p>
							</div>
						</div>

						<ul class="mt-5 flex flex-col gap-3.5 text-sm">
							<li class="flex items-start gap-3">
								<Check size={18} class="mt-0.5 shrink-0 text-gold" />
								<span>
									<strong class="text-foreground">Muestra digital previa:</strong> ves cómo luce tu logotipo
									antes de autorizar el anticipo.
								</span>
							</li>
							<li class="flex items-start gap-3">
								<Check size={18} class="mt-0.5 shrink-0 text-gold" />
								<span>
									<strong class="text-foreground">Mezcla libre de tallas:</strong> completa tu mínimo
									combinando CH, M, G, XG y XXG según tu equipo.
								</span>
							</li>
							<li class="flex items-start gap-3">
								<Check size={18} class="mt-0.5 shrink-0 text-gold" />
								<span>
									<strong class="text-foreground">Rastreo transparente:</strong> cada pedido recibe un
									folio oficial para seguimiento en línea.
								</span>
							</li>
						</ul>

						<div class="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-5 text-center">
							<div class="rounded-lg bg-surface p-2.5">
								<p class="text-xs font-bold text-gold">{data.settings.stat_piezas_entregadas}</p>
								<p class="mt-0.5 text-[11px] text-muted-foreground">Calidad verificada</p>
							</div>
							<div class="rounded-lg bg-surface p-2.5">
								<p class="text-xs font-bold text-gold">{data.settings.stat_tiempo_respuesta}</p>
								<p class="mt-0.5 text-[11px] text-muted-foreground">Atención ágil</p>
							</div>
							<div class="rounded-lg bg-surface p-2.5">
								<p class="text-xs font-bold text-gold">{data.settings.stat_minimo_piezas}</p>
								<p class="mt-0.5 text-[11px] text-muted-foreground">Precios mayoreo</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- 2. Muestras Reales de Taller (Social Proof) & Garantías (Risk Reversal) -->
	<section class="dark bg-background py-14 text-foreground md:py-20">
		<div class="mx-auto max-w-7xl px-4 md:px-6">
			{#if data.portfolio.length > 0}
				<div id="portafolio" class="scroll-mt-28 pb-14">
					<div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
						<div>
							<p class="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
								Muestras reales de taller
							</p>
							<h2 class="mt-2 font-display text-2xl font-bold md:text-4xl">
								Trabajos entregados y acabados
							</h2>
							<p class="mt-1 max-w-xl text-sm text-muted-foreground">
								Evidencia real de uniformes, grabados láser y lotes personalizados producidos en
								nuestro taller.
							</p>
						</div>
						<a
							href={resolve('/(store)/galeria')}
							class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
						>
							Ver galería completa <ArrowRight size={15} />
						</a>
					</div>

					<div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{#each data.portfolio as item (item.id)}
							<figure class="overflow-hidden rounded-xl border border-border bg-surface">
								<div class="aspect-[4/3] bg-surface-raised">
									<ProtectedImage
										image={{
											key: item.id,
											src: item.kind === 'b2b' ? `/img/b2b/${item.id}` : `/img/g/${item.id}`,
											version: item.version
										}}
										sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
										alt={item.titulo}
										class="size-full"
									/>
								</div>
								<figcaption class="flex items-center justify-between gap-2 p-4">
									<span class="text-sm font-semibold text-foreground">{item.titulo}</span>
									<span
										class="shrink-0 rounded-md bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-gold"
									>
										{item.giro_empresa}
									</span>
								</figcaption>
							</figure>
						{/each}
					</div>
				</div>
			{/if}

			<div
				id="garantias"
				class={cn('scroll-mt-28', data.portfolio.length > 0 ? 'border-t border-border pt-14' : '')}
			>
				<div class="max-w-2xl">
					<p class="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
						Cero incertidumbre en tu compra
					</p>
					<h2 class="mt-2 font-display text-2xl font-bold md:text-3xl">
						Garantías pensadas para encargados de compras y dueños de negocio
					</h2>
				</div>

				<div class="mt-8 grid gap-6 md:grid-cols-3">
					{#each data.settings.garantias as garantia, i (i)}
						<div class="rounded-2xl border border-border bg-surface p-6">
							<div
								class="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-gold-fill font-display text-sm font-bold text-on-gold"
							>
								0{i + 1}
							</div>
							<h3 class="font-display text-lg font-bold text-foreground">{garantia.titulo}</h3>
							<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
								{garantia.descripcion}
							</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- 3. When no preloaded logo was present at the top, render Visualiza tu identidad here -->
	{#if !hasPreloadedMockups}
		{@render mockupStudioSection(false)}
	{/if}

	<!-- 4. Volume Savings Simulator (Price Anchoring) -->
	{#if activeLine && simulation}
		<section id="simulador" class="scroll-mt-28 border-b border-border bg-surface py-14 md:py-20">
			<div class="mx-auto max-w-7xl px-4 md:px-6">
				<div
					class="grid items-center gap-8 rounded-2xl border border-border bg-card p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10"
				>
					<div>
						<div
							class="flex items-center gap-2.5 text-xs font-semibold tracking-[0.2em] text-gold uppercase"
						>
							<Calculator size={16} /> Simulador de ahorro por volumen
						</div>
						<h2 class="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
							Calcula la tarifa de mayoreo{data.prospect.empresa
								? ` para ${data.prospect.empresa}`
								: ' al instante'}
						</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							Precios de referencia transparentes. El monto exacto se confirma con base en el tamaño
							y ubicación de tu logotipo.
						</p>

						<!-- Line selector -->
						<div class="mt-6 flex flex-col gap-2">
							<span class="text-xs font-medium text-muted-foreground uppercase"
								>1. Elige el tipo de producto</span
							>
							<div class="grid gap-2.5 sm:grid-cols-2">
								{#each data.settings.escalas_simulador as line (line.id)}
									<button
										type="button"
										onclick={() => (selectedLineId = line.id)}
										class={cn(
											'flex min-h-11 items-center justify-between rounded-lg border px-3.5 py-2 text-left text-sm font-medium transition-colors',
											activeLine.id === line.id
												? 'border-gold bg-gold-fill/15 text-foreground'
												: 'border-border bg-surface text-muted-foreground hover:text-foreground'
										)}
									>
										<span>{line.nombre}</span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Quantity selector -->
						<div class="mt-6 flex flex-col gap-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<label for="sim-qty" class="text-xs font-medium text-muted-foreground uppercase">
									2. Cantidad estimada de piezas
								</label>
								<div class="flex items-center gap-1.5">
									{#each QUICK_QTYS as q (q)}
										<button
											type="button"
											onclick={() => (simQty = q)}
											class={cn(
												'min-h-9 rounded-md border px-2.5 text-xs font-semibold tabular-nums transition-colors',
												simQty === q
													? 'border-gold bg-gold-fill text-on-gold'
													: 'border-border bg-surface text-muted-foreground hover:text-foreground'
											)}
										>
											{q} pzas
										</button>
									{/each}
								</div>
							</div>

							<div class="flex items-center gap-4">
								<input
									id="sim-qty"
									type="range"
									min="5"
									max="150"
									step="1"
									bind:value={simQty}
									class="h-2 flex-1 cursor-pointer accent-primary"
								/>
								<input
									type="number"
									min="1"
									max="5000"
									bind:value={simQty}
									aria-label="Cantidad exacta a simular"
									class="h-11 w-24 rounded-lg border border-border bg-surface px-3 text-center text-base font-bold text-foreground tabular-nums"
								/>
							</div>
						</div>
					</div>

					<!-- Anchored Price Result Card -->
					<div
						class="flex flex-col justify-between rounded-xl border border-gold/40 bg-surface p-6"
					>
						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<p class="text-xs text-muted-foreground">Precio unitario mayoreo</p>
								<div class="mt-1 flex items-baseline gap-2">
									<span class="text-3xl font-bold text-foreground tabular-nums">
										{formatMoney(simulation.precioUnitario)}
									</span>
									{#if simulation.ahorroPorPieza > 0}
										<s class="text-xs text-muted-foreground tabular-nums">
											<span class="sr-only">Precio menudeo antes </span>
											{formatMoney(simulation.precioNormalUnitario)}
										</s>
									{/if}
								</div>
								<p class="mt-1 text-xs text-muted-foreground">
									{simulation.escalaActiva
										? `Escala activa: ${simulation.escalaActiva.etiqueta}`
										: 'Menudeo (mayoreo desde 10 pzas)'}
								</p>
							</div>

							<div>
								<p class="text-xs text-muted-foreground">
									Total estimado ({simulation.cantidad}
									{simulation.cantidad === 1 ? activeLine.unidad : `${activeLine.unidad}s`})
								</p>
								<p class="mt-1 text-3xl font-bold text-gold tabular-nums">
									{formatMoney(simulation.totalEstimado)}
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Anticipo 50%: {formatMoney(Math.round(simulation.totalEstimado / 2))}
								</p>
							</div>
						</div>

						<div class="mt-5">
							{#if simulation.ahorroTotal > 0}
								<div
									class="flex items-center justify-between rounded-lg bg-gold-fill px-4 py-3 text-on-gold"
								>
									<span class="text-xs font-semibold tracking-wider uppercase">
										Ahorro corporativo estimado
									</span>
									<span class="text-lg font-bold tabular-nums">
										{formatMoney(simulation.ahorroTotal)} (-{simulation.porcentajeAhorro}%)
									</span>
								</div>
							{:else}
								<p
									class="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground"
								>
									Sube a 10 piezas o más para activar el descuento corporativo por volumen.
								</p>
							{/if}
						</div>

						{#if simulation.siguienteEscala}
							<div
								class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground"
							>
								<span>
									💡 Agrega <strong class="text-foreground"
										>{simulation.piezasParaSiguienteEscala} piezas más</strong
									>
									para bajar a
									<strong class="text-gold"
										>{formatMoney(simulation.siguienteEscala.precio_unitario)}</strong
									> c/u.
								</span>
								<button
									type="button"
									onclick={() => {
										if (simulation.siguienteEscala) simQty = simulation.siguienteEscala.min;
									}}
									class="font-semibold text-purple-light hover:underline"
								>
									Subir a {simulation.siguienteEscala.min} pzas →
								</button>
							</div>
						{/if}

						<div class="mt-6 border-t border-border pt-4">
							<button
								type="button"
								onclick={transferSimulationToQuote}
								class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
							>
								Usar este cálculo en mi cotización <ArrowRight size={15} />
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- 5. Corporate Packages & Solutions (PENULTIMATE SECTION) -->
	<section
		id="soluciones"
		class="mx-auto max-w-7xl scroll-mt-28 border-b border-border px-4 py-14 md:px-6 md:py-20"
	>
		<div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div>
				<p class="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
					Soluciones listas para {data.prospect.empresa ?? 'tu marca'}
				</p>
				<h2 class="mt-2 font-display text-2xl font-bold text-foreground md:text-4xl">
					Paquetes corporativos y líneas de taller
				</h2>
			</div>
			<p class="max-w-md text-sm text-muted-foreground">
				Elige un paquete base para prellenar tu solicitud abajo o combínalos a la medida de tu
				evento, uniforme o regalo corporativo.
			</p>
		</div>

		<div class="mt-8 grid gap-6 md:grid-cols-2">
			{#each data.packages as pack (pack.id)}
				{@const isSelected = solucion === pack.nombre}
				<article
					class={cn(
						'flex flex-col justify-between rounded-2xl border bg-card p-6 transition-all md:p-7',
						isSelected
							? 'border-gold ring-2 ring-gold/30'
							: pack.destacado
								? 'border-gold/50'
								: 'border-border'
					)}
				>
					<div>
						{#if pack.imagekit_path}
							<div class="mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-surface-raised">
								<ProtectedImage
									image={{ key: pack.id, src: `/img/b2b/${pack.id}`, version: pack.version }}
									sizes="(min-width: 768px) 50vw, 100vw"
									alt={pack.nombre}
									class="size-full"
								/>
							</div>
						{/if}

						<div class="flex flex-wrap items-center justify-between gap-2">
							<span
								class="inline-flex items-center rounded-md bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted-foreground"
							>
								Mínimo {pack.cantidad_minima} piezas
							</span>
							{#if pack.destacado}
								<span
									class="inline-flex items-center gap-1 rounded-md bg-gold-fill px-2.5 py-1 text-xs font-semibold text-on-gold"
								>
									<Sparkles size={12} /> Más solicitado por empresas
								</span>
							{/if}
						</div>

						<h3 class="mt-3 font-display text-xl font-bold text-foreground md:text-2xl">
							{pack.nombre}
						</h3>
						{#if pack.subtitulo}
							<p class="mt-1 text-sm font-medium text-gold">{pack.subtitulo}</p>
						{/if}
						<p class="mt-2.5 text-sm leading-relaxed text-muted-foreground">
							{pack.descripcion}
						</p>

						<ul class="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
							{#each pack.incluye as item, idx (idx)}
								<li class="flex items-start gap-2.5 text-foreground/90">
									<Check size={16} class="mt-0.5 shrink-0 text-gold" />
									<span>{item}</span>
								</li>
							{/each}
						</ul>
					</div>

					<div
						class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"
					>
						<div>
							<p class="text-xs text-muted-foreground">Inversión en volumen desde</p>
							<p class="text-xl font-bold text-foreground tabular-nums">
								{formatMoney(pack.precio_desde)}
								<span class="text-xs font-normal text-muted-foreground">/ pza</span>
							</p>
						</div>
						<button
							type="button"
							onclick={() => selectPackageForQuote(pack.nombre, pack.cantidad_minima)}
							class={cn(
								'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors',
								isSelected
									? 'bg-gold-fill text-on-gold'
									: 'bg-primary text-primary-foreground hover:bg-primary-hover'
							)}
						>
							{isSelected ? 'Seleccionado para cotizar' : 'Cotizar este paquete'}
							<ArrowRight size={15} />
						</button>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- 6. Structured B2B Quote Form + Process & FAQs (FINAL SECTION) -->
	<section id="cotizador" class="mx-auto max-w-7xl scroll-mt-28 px-4 py-14 md:px-6 md:py-20">
		<div class="grid items-start gap-12 lg:grid-cols-[1.2fr_0.8fr]">
			<div class="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
				<div
					class="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-gold uppercase"
				>
					<ShieldCheck size={16} /> Cotización formal con folio
				</div>
				<h2 class="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
					{data.prospect.empresa
						? `Solicita la propuesta oficial para ${data.prospect.empresa}`
						: 'Solicita tu propuesta y muestra digital'}
				</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Recibirás tu folio al instante y te contactaremos por WhatsApp con el cálculo exacto y la
					previsualización definitiva de tu logotipo.
				</p>

				{#if form?.message}
					<p
						role="alert"
						class="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
					>
						{form.message}
					</p>
				{/if}

				<form
					method="POST"
					action="?/cotizar"
					enctype="multipart/form-data"
					class="mt-6 flex flex-col gap-6"
					use:enhance={({ formData }) => {
						fileError = null;
						formData.delete('referencias');
						const totalBytes = references.reduce((sum, item) => sum + item.file.size, 0);
						if (totalBytes > MAX_UPLOAD_TOTAL) {
							fileError = 'Los archivos adjuntos son muy pesados. Sube menos o de menor tamaño.';
							return () => {};
						}
						for (const item of references) formData.append('referencias', item.file);
						sending = true;
						return async ({ update }) => {
							await update();
							sending = false;
						};
					}}
				>
					{#if data.prospect.slug}
						<input type="hidden" name="prospect_slug" value={data.prospect.slug} />
					{/if}

					<!-- Step 1: Company & Contact -->
					<div class="grid gap-4 sm:grid-cols-2">
						<label class={label}>
							<span>Empresa, negocio o institución *</span>
							<input
								name="empresa"
								required
								maxlength="100"
								bind:value={empresa}
								placeholder="Ej. Cafetería Central"
								class={field}
							/>
						</label>
						<label class={label}>
							<span>Tu nombre y cargo *</span>
							<input
								name="nombre"
								required
								maxlength="80"
								bind:value={nombre}
								autocomplete="name"
								placeholder="Ej. Sofía Hernández · Compras"
								class={field}
							/>
						</label>
						<label class={label}>
							<span>WhatsApp directo (10 dígitos) *</span>
							<input
								name="whatsapp"
								type="tel"
								inputmode="numeric"
								required
								maxlength="20"
								autocomplete="tel-national"
								placeholder="961 123 4567"
								class={field}
							/>
						</label>
						<label class={label}>
							<span>Correo corporativo (opcional)</span>
							<input
								name="correo"
								type="email"
								maxlength="120"
								autocomplete="email"
								placeholder="compras@tuempresa.com"
								class={field}
							/>
						</label>
					</div>

					<!-- Step 2: Solution, Quantity & Event Date -->
					<div class="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
						<label class="{label} sm:col-span-2">
							<span>Paquete o línea de interés *</span>
							<select name="solucion" required bind:value={solucion} class={field}>
								<option value="" disabled>Selecciona una opción…</option>
								{#each data.packages as pack (pack.id)}
									<option value={pack.nombre}
										>{pack.nombre} (desde {formatMoney(pack.precio_desde)})</option
									>
								{/each}
								{#each data.settings.escalas_simulador as line (line.id)}
									<option value={line.nombre}>{line.nombre}</option>
								{/each}
								<option value="Proyecto corporativo a medida">
									Proyecto corporativo a medida / Varios productos
								</option>
							</select>
						</label>

						<label class={label}>
							<span>Cantidad aprox. *</span>
							<input
								name="cantidad"
								type="number"
								min="1"
								max="5000"
								required
								bind:value={cantidad}
								class={field}
							/>
						</label>
					</div>

					<div class="flex flex-col gap-2">
						<label class={label}>
							<span>¿Tienes fecha de evento o entrega límite? (opcional)</span>
							<input
								name="fecha_deseada"
								type="date"
								min={today}
								bind:value={fechaDeseada}
								class={field}
							/>
						</label>
						<p
							class={cn(
								'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
								leadTime.tier === 'urgente'
									? 'bg-warning/15 text-warning'
									: 'bg-surface text-muted-foreground'
							)}
						>
							<Clock size={14} class="shrink-0" />
							<span>{leadTime.label}</span>
						</p>
					</div>

					<label class={label}>
						<span>Detalles del proyecto (colores de prenda, ubicación del logo, tallas) *</span>
						<textarea
							name="descripcion"
							required
							rows="3"
							maxlength="800"
							placeholder="Ej. Necesitamos 30 playeras negras con logo blanco en pecho izquierdo y 30 termos grabados en láser para nuestro aniversario."
							class="w-full rounded-lg border border-border bg-surface p-3 text-base text-foreground placeholder:text-muted-foreground focus:border-purple-light"
						></textarea>
					</label>

					<!-- Logo / Reference files -->
					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium text-foreground">
							Logotipo o boceto (opcional, hasta {MAX_REFERENCE_IMAGES} imágenes)
						</span>
						{#if data.prospect.logoUrl && references.length === 0}
							<div
								class="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-fill/10 px-3.5 py-2.5 text-xs text-foreground"
							>
								<Check size={15} class="shrink-0 text-gold" />
								<span>
									Ya contamos con el logotipo precargado de
									<strong>{data.prospect.empresa}</strong>. Se adjuntará automáticamente a tu folio
									(o sube archivos adicionales aquí).
								</span>
							</div>
						{/if}
						{#if fileError}
							<p role="alert" class="text-xs text-danger">{fileError}</p>
						{/if}
						<div class="flex flex-wrap gap-3">
							{#each references as ref, index (ref.url)}
								<div
									class="relative size-20 overflow-hidden rounded-lg border border-border bg-surface"
								>
									<img src={ref.url} alt="" class="size-full object-contain p-1" />
									<button
										type="button"
										onclick={() => removeReference(index)}
										aria-label="Quitar archivo {index + 1}"
										class="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/90 text-foreground"
									>
										<X size={13} />
									</button>
								</div>
							{/each}
							{#if references.length < MAX_REFERENCE_IMAGES}
								<label
									class="flex h-20 cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-gold hover:text-foreground"
								>
									<ImagePlus size={18} class="text-gold" />
									<span>Adjuntar logo (PNG/JPG/WebP)</span>
									<input
										type="file"
										accept="image/jpeg,image/png,image/webp"
										multiple
										onchange={addReferences}
										class="sr-only"
									/>
								</label>
							{/if}
						</div>
					</div>

					<!-- Step 3: Delivery Method -->
					<fieldset class="flex flex-col gap-2.5 border-t border-border pt-5">
						<legend class="mb-1 text-sm font-medium text-foreground">
							Modalidad de entrega preferida
						</legend>
						<div class="grid gap-2.5 sm:grid-cols-3">
							{#each DELIVERY_METHODS as option (option.value)}
								<label
									class={cn(
										'flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-xs font-medium transition-colors',
										metodoEntrega === option.value
											? 'border-gold bg-gold-fill/15 text-foreground'
											: 'border-border bg-surface text-muted-foreground'
									)}
								>
									<input
										type="radio"
										name="metodoEntrega"
										value={option.value}
										bind:group={metodoEntrega}
										class="accent-primary"
									/>
									<span>{option.label}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					{#if metodoEntrega !== 'recoger'}
						<div class="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
							<label class="{label} sm:col-span-2">
								<span>Calle y número *</span>
								<input name="calle" required maxlength="120" class={field} />
							</label>
							<label class={label}>
								<span>Colonia *</span>
								<input name="colonia" required maxlength="80" class={field} />
							</label>
							<label class={label}>
								<span>Código postal *</span>
								<input
									name="cp"
									required
									inputmode="numeric"
									pattern="\d{5}"
									maxlength="5"
									class={field}
								/>
							</label>
							<label class={label}>
								<span>Ciudad *</span>
								<input name="ciudad" required maxlength="80" class={field} />
							</label>
							<label class={label}>
								<span>Estado *</span>
								<input name="estado" required maxlength="60" value="Chiapas" class={field} />
							</label>
							<label class="{label} sm:col-span-2">
								<span>Referencias de entrega (opcional)</span>
								<input name="referencias_domicilio" maxlength="200" class={field} />
							</label>
						</div>
					{/if}

					<button
						type="submit"
						disabled={sending}
						class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
					>
						{sending ? 'Generando folio empresarial…' : 'Obtener folio y cotización empresarial'}
						<ArrowRight size={18} />
					</button>
				</form>
			</div>

			<!-- Right column: 3-Step Timeline + B2B FAQs -->
			<div class="flex flex-col gap-8">
				<div class="rounded-2xl border border-border bg-surface p-6">
					<p class="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
						Proceso claro de principio a fin
					</p>
					<h3 class="mt-2 font-display text-xl font-bold text-foreground">
						¿Cómo trabajamos con {data.prospect.empresa ?? 'tu empresa'}?
					</h3>
					<ol class="mt-5 flex flex-col gap-4 text-sm">
						<li class="flex gap-3.5">
							<span
								class="grid size-7 shrink-0 place-items-center rounded-full bg-gold-fill text-xs font-bold text-on-gold"
								>1</span
							>
							<div>
								<p class="font-semibold text-foreground">Envías tu idea o logotipo</p>
								<p class="text-xs text-muted-foreground">
									Registras tus cantidades aproximadas y obtienes tu folio `OUR-AAMM-NNNN`.
								</p>
							</div>
						</li>
						<li class="flex gap-3.5">
							<span
								class="grid size-7 shrink-0 place-items-center rounded-full bg-gold-fill text-xs font-bold text-on-gold"
								>2</span
							>
							<div>
								<p class="font-semibold text-foreground">Recibes mockup digital y cotización</p>
								<p class="text-xs text-muted-foreground">
									Ajustamos el diseño sin costo hasta que tu equipo apruebe la muestra visual.
								</p>
							</div>
						</li>
						<li class="flex gap-3.5">
							<span
								class="grid size-7 shrink-0 place-items-center rounded-full bg-gold-fill text-xs font-bold text-on-gold"
								>3</span
							>
							<div>
								<p class="font-semibold text-foreground">Producción 50/50 y entrega puntual</p>
								<p class="text-xs text-muted-foreground">
									Confirmas con el 50% de anticipo, sigues el avance en línea y liquidas contra
									entrega o evidencia fotográfica.
								</p>
							</div>
						</li>
					</ol>
				</div>

				<div class="flex flex-col gap-3">
					<h3 class="font-display text-xl font-bold text-foreground">
						Preguntas frecuentes de empresas
					</h3>
					{#each data.settings.faqs as faq, idx (idx)}
						<details class="group rounded-xl border border-border bg-card p-4">
							<summary
								class="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground"
							>
								<span>{faq.pregunta}</span>
								<span class="text-gold transition-transform group-open:rotate-45">+</span>
							</summary>
							<p class="mt-2.5 text-sm leading-relaxed text-muted-foreground">
								{faq.respuesta}
							</p>
						</details>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}
