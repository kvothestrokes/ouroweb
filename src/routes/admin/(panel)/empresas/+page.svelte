<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		Building2,
		Check,
		Copy,
		ExternalLink as ExternalLinkIcon,
		ImagePlus,
		MessageSquareShare,
		PackageCheck,
		Pencil,
		Plus,
		Search,
		Settings2,
		Sparkles,
		Trash2,
		Upload
	} from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import {
		DEFAULT_OUTBOUND_TEMPLATES,
		buildProspectingLink,
		buildProspectingMessage,
		type B2bLogoSurface
	} from '#lib/domain/b2b.js';
	import { formatMoney } from '#lib/domain/money.js';
	import { normalizeMxPhone } from '#lib/domain/phone.js';
	import { whatsappLink } from '#lib/domain/whatsapp.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const TABS = [
		{ id: 'prospeccion', label: 'Prospección y links', icon: MessageSquareShare },
		{ id: 'paquetes', label: 'Paquetes corporativos', icon: PackageCheck },
		{ id: 'portafolio', label: 'Portafolio B2B', icon: ImagePlus },
		{ id: 'config', label: 'Textos, garantías y FAQs', icon: Settings2 }
	] as const;

	let activeTab = $state<(typeof TABS)[number]['id']>('prospeccion');
	let busy = $state(false);

	// Outbound Prospecting Generator & Saved Prospects state
	let editingProspectId = $state<string | null>(null);
	let editingProspectSlug = $state<string | null>(null);
	let prospectEmpresa = $state('Cafetería Central');
	let prospectContacto = $state('');
	let prospectWhatsapp = $state('');
	let prospectPack = $state('');
	let prospectNota = $state('');
	let prospectLogoSurface = $state<B2bLogoSurface>('dark');
	let existingLogoSrc = $state<string | null>(null);
	let removeExistingLogo = $state(false);
	let localLogoPreviewUrl = $state<string | null>(null);
	let selectedTemplateKey = $state('b2b_prospeccion_frio');
	let copiedKind = $state<string | null>(null);
	let prospectSearch = $state('');

	const activeLogoPreview = $derived(
		localLogoPreviewUrl ?? (removeExistingLogo ? null : existingLogoSrc)
	);

	const filteredProspects = $derived.by(() => {
		const q = prospectSearch.trim().toLowerCase();
		if (!q) return data.prospects;
		return data.prospects.filter(
			(item) =>
				item.empresa.toLowerCase().includes(q) ||
				item.slug.toLowerCase().includes(q) ||
				(item.contacto && item.contacto.toLowerCase().includes(q)) ||
				(item.whatsapp && item.whatsapp.includes(q))
		);
	});

	const activeTemplate = $derived(
		data.templates.find((t) => t.clave === selectedTemplateKey) ?? DEFAULT_OUTBOUND_TEMPLATES[0]
	);

	const generatedLink = $derived(
		buildProspectingLink(data.origin, {
			slug: editingProspectSlug ?? undefined,
			empresa: prospectEmpresa,
			contacto: prospectContacto,
			pack: prospectPack
		})
	);

	const generatedMessage = $derived(
		buildProspectingMessage(activeTemplate.cuerpo, {
			empresa: prospectEmpresa,
			contacto: prospectContacto,
			linkEmpresas: generatedLink,
			notaExtra: prospectNota
		})
	);

	const normalizedProspectPhone = $derived(
		prospectWhatsapp.trim() ? normalizeMxPhone(prospectWhatsapp) : null
	);

	const faqsTextInitial = $derived(
		data.settings.faqs.map((f) => `${f.pregunta}\n${f.respuesta}`).join('\n\n')
	);

	function resetProspectForm() {
		editingProspectId = null;
		editingProspectSlug = null;
		prospectEmpresa = '';
		prospectContacto = '';
		prospectWhatsapp = '';
		prospectPack = '';
		prospectNota = '';
		prospectLogoSurface = 'dark';
		existingLogoSrc = null;
		removeExistingLogo = false;
		if (localLogoPreviewUrl) {
			URL.revokeObjectURL(localLogoPreviewUrl);
			localLogoPreviewUrl = null;
		}
	}

	function selectProspectForGenerator(item: (typeof data.prospects)[number]) {
		editingProspectId = item.id;
		editingProspectSlug = item.slug;
		prospectEmpresa = item.empresa;
		prospectContacto = item.contacto ?? '';
		prospectWhatsapp = item.whatsapp ? item.whatsapp.replace(/^52/, '') : '';
		prospectPack = item.paquete_slug ?? '';
		prospectNota = item.nota ?? '';
		prospectLogoSurface = item.logo_fondo_sugerido;
		existingLogoSrc = item.logoSrc;
		removeExistingLogo = false;
		if (localLogoPreviewUrl) {
			URL.revokeObjectURL(localLogoPreviewUrl);
			localLogoPreviewUrl = null;
		}
	}

	function onLogoFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (localLogoPreviewUrl) {
			URL.revokeObjectURL(localLogoPreviewUrl);
			localLogoPreviewUrl = null;
		}
		if (file && file.size > 0) {
			localLogoPreviewUrl = URL.createObjectURL(file);
			removeExistingLogo = false;
		}
	}

	async function copyText(value: string, kind: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedKind = kind;
			setTimeout(() => {
				if (copiedKind === kind) copiedKind = null;
			}, 2200);
		} catch {
			// Clipboard not available
		}
	}

	const submitPlain: SubmitFunction = () => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	};

	const submitWithPhoto: SubmitFunction = async ({ formData }) => {
		busy = true;
		const photo = formData.get('foto');
		if (photo instanceof File && photo.size > 0) {
			formData.set('foto', await downscaleImage(photo, 1800, { keepPng: false }));
		}
		return async ({ update }) => {
			await update();
			busy = false;
		};
	};

	const submitProspect: SubmitFunction = async ({ formData }) => {
		busy = true;
		const logo = formData.get('logo');
		if (logo instanceof File && logo.size > 0) {
			formData.set('logo', await downscaleImage(logo, 1400, { keepPng: true }));
		}
		return async ({ result, update }) => {
			await update({ reset: false });
			busy = false;
			if (result.type === 'success') {
				const savedSlug =
					typeof result.data?.savedProspectSlug === 'string' ? result.data.savedProspectSlug : null;
				if (savedSlug) {
					const found = data.prospects.find((p) => p.slug === savedSlug);
					if (found) selectProspectForGenerator(found);
				}
			}
		};
	};

	const textareaClass =
		'w-full rounded-md border border-border bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-light';
	const selectClass =
		'min-h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground';
</script>

<svelte:head>
	<title>Empresas (B2B) · Panel Ouroboros</title>
</svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="font-display text-2xl text-foreground md:text-3xl">
			Canal de Empresas y Mayoreo (B2B)
		</h1>
		<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
			Genera enlaces y mensajes personalizados para prospectar empresas por WhatsApp, y configura
			los paquetes, casos de éxito y garantías de la vista pública.
		</p>
	</div>
	<a
		href={resolve('/(store)/empresas')}
		target="_blank"
		rel="noopener noreferrer"
		class="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-gold"
	>
		Ver página /empresas <ExternalLinkIcon size={15} class="text-gold" />
	</a>
</div>

{#if !data.migrationReady}
	<div
		class="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning"
		role="status"
	>
		Mostrando valores predeterminados. Ejecuta <code>npx supabase db push</code> cuando quieras persistir
		cambios de paquetes y portafolio en la base de datos.
	</div>
{/if}

<FormMessage error={form?.message} success={form?.success} class="mt-5" />

<!-- Navigation tabs -->
<div class="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-3">
	{#each TABS as tab (tab.id)}
		{@const Icon = tab.icon}
		<button
			type="button"
			onclick={() => (activeTab = tab.id)}
			class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors {activeTab ===
			tab.id
				? 'bg-primary text-primary-foreground'
				: 'bg-card text-muted-foreground hover:bg-surface-raised hover:text-foreground'}"
		>
			<Icon size={17} strokeWidth={1.75} />
			{tab.label}
		</button>
	{/each}
</div>

<!-- TAB 1: Outbound Prospecting Generator & Saved Prospects List -->
{#if activeTab === 'prospeccion'}
	<div class="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
		<form
			method="POST"
			action="?/guardarProspecto"
			enctype="multipart/form-data"
			use:enhance={submitProspect}
			class="rounded-xl border border-border bg-card p-5 md:p-6"
		>
			{#if editingProspectId}
				<input type="hidden" name="id" value={editingProspectId} />
				<input type="hidden" name="slug" value={editingProspectSlug ?? ''} />
			{/if}
			{#if removeExistingLogo}
				<input type="hidden" name="eliminar_logo" value="1" />
			{/if}

			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div
						class="flex items-center gap-2 text-xs font-semibold tracking-wider text-gold uppercase"
					>
						<Sparkles size={15} />
						{editingProspectId
							? 'Editando empresa guardada'
							: 'Nueva empresa / enlace personalizado'}
					</div>
					<h2 class="mt-1 font-display text-xl text-foreground">
						1. Datos y logotipo precargado de la empresa
					</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Si precargas el logotipo de la empresa, al abrir su enlace personalizado verá sus
						mockups hasta arriba con su nombre en grande.
					</p>
				</div>
				{#if editingProspectId || prospectEmpresa}
					<Button
						type="button"
						variant="outline"
						class="min-h-9 gap-1.5 text-xs"
						onclick={resetProspectForm}
					>
						<Plus size={14} /> Nueva empresa
					</Button>
				{/if}
			</div>

			<div class="mt-5 grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5 sm:col-span-2">
					<Label for="p-empresa">Nombre de la empresa o negocio *</Label>
					<Input
						id="p-empresa"
						name="empresa"
						bind:value={prospectEmpresa}
						oninput={() => {
							if (!editingProspectId) editingProspectSlug = null;
						}}
						required
						maxlength={80}
						placeholder="Ej. Gimnasio Titán, Restaurante El Mirador…"
						class="min-h-11"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label for="p-contacto">Nombre del contacto (opcional)</Label>
					<Input
						id="p-contacto"
						name="contacto"
						bind:value={prospectContacto}
						maxlength={60}
						placeholder="Ej. Sofía"
						class="min-h-11"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label for="p-wa">WhatsApp de la empresa (10 dígitos, opc.)</Label>
					<Input
						id="p-wa"
						name="whatsapp"
						bind:value={prospectWhatsapp}
						maxlength={20}
						inputmode="numeric"
						placeholder="961 123 4567"
						class="min-h-11"
					/>
				</div>

				<div class="flex flex-col gap-1.5 sm:col-span-2">
					<Label for="p-pack">Paquete recomendado para destacar</Label>
					<select id="p-pack" name="paquete_slug" bind:value={prospectPack} class={selectClass}>
						<option value="">Mostrar todos (primer paquete por defecto)</option>
						{#each data.packages as pack (pack.id)}
							<option value={pack.slug}>{pack.nombre} ({formatMoney(pack.precio_desde)})</option>
						{/each}
					</select>
				</div>

				<div class="flex flex-col gap-1.5 sm:col-span-2">
					<Label for="p-nota">Rompehielo o nota personalizada (opcional)</Label>
					<Input
						id="p-nota"
						name="nota"
						bind:value={prospectNota}
						maxlength={280}
						placeholder="Ej. Vimos que están por inaugurar su nueva sucursal en el centro."
						class="min-h-11"
					/>
				</div>

				<!-- Logo Preloader & Mockup Surface Selector -->
				<div class="rounded-xl border border-gold/30 bg-surface p-4 sm:col-span-2">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold tracking-wider text-gold uppercase">
								Precargar logotipo para mockups instantáneos (opcional)
							</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								Sube el logo en PNG transparente, WebP o JPG. Al entrar al link, la empresa verá sus
								mockups hasta arriba.
							</p>
						</div>
						<label
							for="p-logo-file"
							class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-gold"
						>
							<Upload size={14} class="text-gold" />
							{activeLogoPreview ? 'Cambiar logotipo' : 'Subir logotipo'}
						</label>
						<input
							id="p-logo-file"
							name="logo"
							type="file"
							accept="image/png,image/webp,image/jpeg"
							onchange={onLogoFileChange}
							class="sr-only"
						/>
					</div>

					<div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
						<div class="flex flex-col gap-1.5">
							<Label for="p-fondo" class="text-xs">Superficie inicial sugerida en el mockup</Label>
							<select
								id="p-fondo"
								name="logo_fondo_sugerido"
								bind:value={prospectLogoSurface}
								class={selectClass}
							>
								<option value="dark">Prenda / Termo oscuro (para logos claros o a color)</option>
								<option value="light">Prenda / Taza clara (para logos oscuros)</option>
							</select>
						</div>

						{#if activeLogoPreview}
							<div class="flex items-end">
								<Button
									type="button"
									variant="outline"
									class="min-h-11 gap-1.5 text-xs text-danger"
									onclick={() => {
										removeExistingLogo = true;
										if (localLogoPreviewUrl) {
											URL.revokeObjectURL(localLogoPreviewUrl);
											localLogoPreviewUrl = null;
										}
									}}
								>
									<Trash2 size={14} /> Quitar logo
								</Button>
							</div>
						{/if}
					</div>

					{#if activeLogoPreview}
						<div class="mt-4 grid grid-cols-2 gap-3">
							<div
								class="dark flex flex-col items-center justify-center rounded-lg border border-border bg-background p-3 text-center {prospectLogoSurface ===
								'dark'
									? 'ring-2 ring-gold'
									: ''}"
							>
								<img
									src={activeLogoPreview}
									alt="Vista previa en oscuro"
									class="h-14 max-w-[140px] object-contain"
								/>
								<span class="mt-2 text-[10px] text-muted-foreground">
									Vista en prenda / termo oscuro
								</span>
							</div>
							<div
								class="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-3 text-center {prospectLogoSurface ===
								'light'
									? 'ring-2 ring-gold'
									: ''}"
							>
								<img
									src={activeLogoPreview}
									alt="Vista previa en claro"
									class="h-14 max-w-[140px] object-contain"
								/>
								<span class="mt-2 text-[10px] text-muted-foreground">
									Vista en prenda / taza clara
								</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div
				class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
			>
				<p class="text-xs text-muted-foreground">
					Guarda la empresa en tu lista para conservar su link corto <code>?p=slug</code> y su logotipo.
				</p>
				<Button type="submit" disabled={busy} class="min-h-11 gap-2">
					<Check size={16} />
					{editingProspectId ? 'Actualizar empresa y enlace' : 'Guardar en lista de empresas'}
				</Button>
			</div>
		</form>

		<section
			class="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 md:p-6"
		>
			<div>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="font-display text-xl text-foreground">
						2. Enlace y mensaje listos para enviar
					</h2>
					{#if editingProspectSlug}
						<span
							class="rounded-full bg-gold-fill/15 px-2.5 py-1 text-[11px] font-semibold text-gold"
						>
							{activeLogoPreview ? 'Con mockups arriba activos' : 'Enlace corto guardado'}
						</span>
					{/if}
				</div>

				<!-- Personalized URL box -->
				<div class="mt-4 rounded-lg border border-border bg-surface p-3.5">
					<p class="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
						Enlace personalizado para {prospectEmpresa || 'la empresa'}
					</p>
					<p class="mt-1 font-mono text-xs break-all text-gold">{generatedLink}</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							class="min-h-10 gap-2 text-xs"
							onclick={() => copyText(generatedLink, 'link')}
						>
							{#if copiedKind === 'link'}
								<Check size={15} class="text-success" /> Enlace copiado
							{:else}
								<Copy size={15} /> Copiar enlace
							{/if}
						</Button>
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={generatedLink}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:border-gold"
						>
							Probar cómo lo verá el cliente <ExternalLinkIcon size={13} />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				</div>

				<div class="mt-4 flex flex-col gap-1.5">
					<Label for="p-tpl">Plantilla de WhatsApp</Label>
					<select id="p-tpl" bind:value={selectedTemplateKey} class={selectClass}>
						{#each data.templates.filter((t) => t.clave !== 'b2b_cotizacion_nueva') as tpl (tpl.clave)}
							<option value={tpl.clave}>{tpl.nombre}</option>
						{/each}
					</select>
				</div>

				<!-- Generated WhatsApp message preview -->
				<div class="mt-4">
					<p class="mb-1.5 text-xs font-medium text-muted-foreground">
						Vista previa del mensaje de WhatsApp
					</p>
					<pre
						class="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">{generatedMessage}</pre>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
				<Button
					type="button"
					class="min-h-11 gap-2"
					onclick={() => copyText(generatedMessage, 'msg')}
				>
					{#if copiedKind === 'msg'}
						<Check size={16} /> ¡Mensaje copiado!
					{:else}
						<Copy size={16} /> Copiar mensaje completo
					{/if}
				</Button>

				{#if normalizedProspectPhone}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={whatsappLink(normalizedProspectPhone, generatedMessage)}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex min-h-11 items-center gap-2 rounded-md bg-gold-fill px-4 text-sm font-semibold text-on-gold transition-opacity hover:opacity-90"
					>
						Enviar a {normalizedProspectPhone} en WhatsApp
						<ExternalLinkIcon size={15} />
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span class="text-xs text-muted-foreground">
						Escribe el WhatsApp a 10 dígitos para abrir el chat directo en 1 clic.
					</span>
				{/if}
			</div>
		</section>
	</div>

	<!-- Saved Prospects List -->
	<section class="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<div
					class="flex items-center gap-2 text-xs font-semibold tracking-wider text-gold uppercase"
				>
					<Building2 size={15} /> Directorio de prospección B2B
				</div>
				<h2 class="mt-1 font-display text-xl text-foreground">
					3. Lista de empresas y enlaces personalizados ({data.prospects.length})
				</h2>
				<p class="text-xs text-muted-foreground">
					Administra las empresas prospectadas, verifica cuáles tienen logotipo precargado para ver
					sus mockups hasta arriba y copia su enlace en 1 clic.
				</p>
			</div>

			{#if data.prospects.length > 0}
				<div class="relative w-full sm:w-72">
					<Search
						size={16}
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						bind:value={prospectSearch}
						placeholder="Buscar empresa, contacto o tel…"
						class="min-h-10 pl-9 text-xs"
					/>
				</div>
			{/if}
		</div>

		{#if data.prospects.length === 0}
			<div
				class="mt-5 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground"
			>
				Aún no has guardado empresas en tu lista. Usa el formulario de arriba para registrar una
				empresa y precargar su logotipo.
			</div>
		{:else if filteredProspects.length === 0}
			<p class="mt-5 text-sm text-muted-foreground">
				No encontramos empresas que coincidan con «{prospectSearch}».
			</p>
		{:else}
			<div class="mt-5 grid gap-3">
				{#each filteredProspects as item (item.id)}
					{@const itemLink = buildProspectingLink(data.origin, {
						slug: item.slug,
						empresa: item.empresa,
						contacto: item.contacto ?? undefined,
						pack: item.paquete_slug ?? undefined
					})}
					{@const itemPack = data.packages.find((p) => p.slug === item.paquete_slug)}
					{@const isSelected = editingProspectId === item.id}
					<div
						class="flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors lg:flex-row lg:items-center {isSelected
							? 'border-gold bg-surface-raised/60'
							: 'border-border bg-surface hover:border-gold/50'}"
					>
						<div class="flex items-start gap-3.5">
							{#if item.logoSrc}
								<div
									class="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border p-1.5 {item.logo_fondo_sugerido ===
									'dark'
										? 'dark bg-background'
										: 'bg-card'}"
								>
									<img
										src={item.logoSrc}
										alt={item.empresa}
										class="max-h-full max-w-full object-contain"
									/>
								</div>
							{:else}
								<div
									class="grid size-14 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-card font-display text-base font-bold text-muted-foreground"
								>
									{item.empresa.slice(0, 2).toUpperCase()}
								</div>
							{/if}

							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="font-display text-base font-bold text-foreground">
										{item.empresa}
									</h3>
									{#if item.logoSrc}
										<span
											class="rounded-full bg-gold-fill/20 px-2.5 py-0.5 text-[11px] font-semibold text-gold"
										>
											Logo y mockups precargados
										</span>
									{:else}
										<span
											class="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
										>
											Sin logo precargado
										</span>
									{/if}
									{#if itemPack}
										<span
											class="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-medium text-purple-light"
										>
											{itemPack.nombre}
										</span>
									{/if}
								</div>

								<p class="mt-1 text-xs text-muted-foreground">
									{#if item.contacto}
										Contacto: <strong class="text-foreground">{item.contacto}</strong> ·
									{/if}
									{#if item.whatsapp}
										Tel: <span class="font-mono">{item.whatsapp.replace(/^52/, '')}</span> ·
									{/if}
									<span class="font-mono text-gold">/empresas?p={item.slug}</span>
								</p>

								{#if item.nota}
									<p class="mt-1 line-clamp-1 text-xs text-muted-foreground italic">
										«{item.nota}»
									</p>
								{/if}
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								class="min-h-9 gap-1.5 text-xs"
								onclick={() => copyText(itemLink, `row-${item.id}`)}
							>
								{#if copiedKind === `row-${item.id}`}
									<Check size={14} class="text-success" /> Copiado
								{:else}
									<Copy size={14} /> Copiar link
								{/if}
							</Button>

							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={itemLink}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-gold"
							>
								Ver landing <ExternalLinkIcon size={13} class="text-gold" />
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->

							<Button
								type="button"
								variant="outline"
								class="min-h-9 gap-1.5 text-xs"
								onclick={() => selectProspectForGenerator(item)}
							>
								<Pencil size={14} />
								{item.logoSrc ? 'Editar / WA' : 'Subir logo / Editar'}
							</Button>

							<form method="POST" action="?/eliminarProspecto" use:enhance={submitPlain}>
								<input type="hidden" name="id" value={item.id} />
								<Button
									type="submit"
									variant="outline"
									disabled={busy}
									aria-label="Eliminar {item.empresa}"
									class="min-h-9 px-2.5 text-danger"
								>
									<Trash2 size={14} />
								</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<!-- TAB 2: Corporate Packages CRUD -->
{#if activeTab === 'paquetes'}
	<div class="mt-6 grid gap-6">
		<form
			method="POST"
			action="?/guardarPaquete"
			enctype="multipart/form-data"
			use:enhance={submitWithPhoto}
			class="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3"
		>
			<div class="sm:col-span-2 lg:col-span-3">
				<h2 class="font-display text-lg text-foreground">Agregar nuevo paquete corporativo</h2>
				<p class="text-xs text-muted-foreground">
					Aparecerá en la cuadrícula de soluciones de <code>/empresas</code> y en el selector del cotizador.
				</p>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-nombre">Nombre del paquete *</Label>
				<Input
					id="new-nombre"
					name="nombre"
					required
					maxlength={80}
					placeholder="Ej. Kit Fin de Año Ejecutivo"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-slug">Slug (opcional, se genera solo)</Label>
				<Input
					id="new-slug"
					name="slug"
					maxlength={80}
					placeholder="kit-fin-de-ano"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-subtitulo">Subtítulo gancho</Label>
				<Input
					id="new-subtitulo"
					name="subtitulo"
					maxlength={140}
					placeholder="Ideal para clientes VIP y socios comerciales"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-precio">Precio «desde» por pieza (MXN) *</Label>
				<Input
					id="new-precio"
					name="precio_desde"
					required
					inputmode="decimal"
					placeholder="290"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-min">Mínimo de piezas *</Label>
				<Input
					id="new-min"
					name="cantidad_minima"
					type="number"
					min="1"
					max="1000"
					value="10"
					required
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="new-orden">Orden</Label>
				<Input
					id="new-orden"
					name="orden"
					type="number"
					min="0"
					max="999"
					value={data.packages.length + 1}
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
				<Label for="new-desc">Descripción comercial *</Label>
				<textarea
					id="new-desc"
					name="descripcion"
					required
					rows="2"
					maxlength="500"
					placeholder="Explica por qué este paquete le resuelve la vida a la empresa…"
					class={textareaClass}></textarea>
			</div>

			<div class="flex flex-col gap-1.5 sm:col-span-2">
				<Label for="new-incluye">Qué incluye (escribe 1 beneficio por línea) *</Label>
				<textarea
					id="new-incluye"
					name="incluye"
					required
					rows="3"
					placeholder="Ej. Termo grabado en láser con tu logo, playera 100% algodón y mockup digital previo"
					class={textareaClass}></textarea>
			</div>

			<div class="flex flex-col justify-between gap-3">
				<div class="flex flex-col gap-1.5">
					<Label for="new-foto">Imagen de portada (opcional)</Label>
					<input
						id="new-foto"
						type="file"
						name="foto"
						accept="image/jpeg,image/png,image/webp"
						class="text-xs text-muted-foreground"
					/>
				</div>

				<div class="flex items-center gap-4 pt-2 text-sm">
					<label class="flex items-center gap-2">
						<input type="checkbox" name="destacado" class="accent-primary" />
						<span>Destacado</span>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" name="activo" checked class="accent-primary" />
						<span>Activo</span>
					</label>
				</div>

				<Button type="submit" disabled={busy} class="min-h-11 w-full">
					{busy ? 'Guardando…' : 'Crear paquete corporativo'}
				</Button>
			</div>
		</form>

		<!-- Existing packages list -->
		<div class="grid gap-4 lg:grid-cols-2">
			{#each data.packages as pack (pack.id)}
				<div class="rounded-xl border border-border bg-card p-5">
					<form
						method="POST"
						action="?/guardarPaquete"
						enctype="multipart/form-data"
						use:enhance={submitWithPhoto}
						class="grid gap-3 sm:grid-cols-2"
					>
						{#if !pack.id.startsWith('default-')}
							<input type="hidden" name="id" value={pack.id} />
						{/if}

						{#if pack.previewSrc}
							<div class="sm:col-span-2">
								<img
									src={pack.previewSrc}
									alt={pack.nombre}
									class="h-36 w-full rounded-lg object-cover"
								/>
							</div>
						{/if}

						<div class="flex flex-col gap-1">
							<Label>Nombre</Label>
							<Input name="nombre" value={pack.nombre} required maxlength={80} class="min-h-10" />
						</div>
						<div class="flex flex-col gap-1">
							<Label>Slug</Label>
							<Input name="slug" value={pack.slug} required maxlength={80} class="min-h-10" />
						</div>
						<div class="flex flex-col gap-1 sm:col-span-2">
							<Label>Subtítulo</Label>
							<Input name="subtitulo" value={pack.subtitulo} maxlength={140} class="min-h-10" />
						</div>
						<div class="flex flex-col gap-1">
							<Label>Precio desde (MXN)</Label>
							<Input
								name="precio_desde"
								value={(pack.precio_desde / 100).toFixed(2)}
								required
								class="min-h-10"
							/>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div class="flex flex-col gap-1">
								<Label>Mín. pzas</Label>
								<Input
									name="cantidad_minima"
									type="number"
									value={pack.cantidad_minima}
									required
									class="min-h-10"
								/>
							</div>
							<div class="flex flex-col gap-1">
								<Label>Orden</Label>
								<Input name="orden" type="number" value={pack.orden} class="min-h-10" />
							</div>
						</div>
						<div class="flex flex-col gap-1 sm:col-span-2">
							<Label>Descripción</Label>
							<textarea name="descripcion" rows="2" required class={textareaClass}
								>{pack.descripcion}</textarea
							>
						</div>
						<div class="flex flex-col gap-1 sm:col-span-2">
							<Label>Qué incluye (1 por línea)</Label>
							<textarea name="incluye" rows="3" required class={textareaClass}
								>{pack.incluye.join('\n')}</textarea
							>
						</div>
						<div class="flex flex-col gap-1 sm:col-span-2">
							<Label>Reemplazar foto (opcional)</Label>
							<input
								type="file"
								name="foto"
								accept="image/jpeg,image/png,image/webp"
								class="text-xs text-muted-foreground"
							/>
						</div>
						<div class="flex items-center gap-4 text-xs sm:col-span-2">
							<label class="flex items-center gap-1.5">
								<input
									type="checkbox"
									name="destacado"
									checked={pack.destacado}
									class="accent-primary"
								/>
								<span>Destacado</span>
							</label>
							<label class="flex items-center gap-1.5">
								<input type="checkbox" name="activo" checked={pack.activo} class="accent-primary" />
								<span>Activo</span>
							</label>
							<div class="ml-auto flex items-center gap-2">
								<Button type="submit" variant="outline" class="min-h-10 text-xs" disabled={busy}>
									Guardar paquete
								</Button>
							</div>
						</div>
					</form>

					{#if !pack.id.startsWith('default-')}
						<form
							method="POST"
							action="?/eliminarPaquete"
							use:enhance={submitPlain}
							class="mt-2 flex justify-end border-t border-border pt-2"
						>
							<input type="hidden" name="id" value={pack.id} />
							<Button type="submit" variant="ghost" class="min-h-9 text-xs text-danger">
								<Trash2 size={14} class="mr-1" /> Eliminar
							</Button>
						</form>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- TAB 3: B2B Portfolio & Case Studies -->
{#if activeTab === 'portafolio'}
	<div class="mt-6">
		<form
			method="POST"
			action="?/subirPortafolio"
			enctype="multipart/form-data"
			use:enhance={submitWithPhoto}
			class="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3"
		>
			<div class="sm:col-span-3">
				<h2 class="font-display text-lg text-foreground">
					Subir foto de caso empresarial / lote entregado
				</h2>
				<p class="text-xs text-muted-foreground">
					Se muestra en <code>/empresas</code> con la marca de agua de Ouroboros y la etiqueta del giro
					o volumen.
				</p>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="pf-titulo">Título del trabajo *</Label>
				<Input
					id="pf-titulo"
					name="titulo"
					required
					maxlength={120}
					placeholder="Ej. Termos grabados en láser mate"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="pf-giro">Giro y volumen (etiqueta)</Label>
				<Input
					id="pf-giro"
					name="giro_empresa"
					maxlength={80}
					placeholder="Ej. Cafetería · 45 piezas"
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col justify-end gap-2">
				<input
					type="file"
					name="foto"
					accept="image/jpeg,image/png,image/webp"
					required
					class="text-xs text-muted-foreground"
				/>
				<Button type="submit" disabled={busy} class="min-h-11">
					{busy ? 'Subiendo…' : 'Agregar al portafolio B2B'}
				</Button>
			</div>
		</form>

		{#if data.portfolio.length === 0}
			<p
				class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
			>
				Aún no has subido fotos exclusivas del portafolio B2B. Mientras tanto, la página
				<code>/empresas</code> muestra automáticamente muestras recientes de tu galería general.
			</p>
		{:else}
			<ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.portfolio as item (item.id)}
					<li class="overflow-hidden rounded-xl border border-border bg-card">
						<img src={item.src} alt={item.titulo} class="aspect-[4/3] w-full object-cover" />
						<div class="flex items-center justify-between gap-2 p-4">
							<div>
								<p class="text-sm font-semibold text-foreground">{item.titulo}</p>
								<p class="text-xs text-gold">{item.giro_empresa}</p>
							</div>
							<form method="POST" action="?/eliminarPortafolio" use:enhance={submitPlain}>
								<input type="hidden" name="id" value={item.id} />
								<Button
									type="submit"
									variant="ghost"
									class="min-h-10 text-danger"
									aria-label="Eliminar {item.titulo}"
								>
									<Trash2 size={16} />
								</Button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<!-- TAB 4: Hero Copy, Trust Metrics, Guarantees & FAQs -->
{#if activeTab === 'config'}
	<form
		method="POST"
		action="?/guardarConfig"
		use:enhance={submitPlain}
		class="mt-6 grid gap-6 rounded-xl border border-border bg-card p-5 md:p-6"
	>
		<div>
			<h2 class="font-display text-lg text-foreground">Encabezado y métricas de confianza</h2>
			<p class="text-xs text-muted-foreground">
				Textos principales que ve la empresa al abrir el enlace.
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5 sm:col-span-2">
				<Label for="cfg-badge">Sello superior (badge)</Label>
				<Input
					id="cfg-badge"
					name="badge_texto"
					value={data.settings.badge_texto}
					maxlength={90}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-1.5 sm:col-span-2">
				<Label for="cfg-titulo">Título principal del Hero *</Label>
				<Input
					id="cfg-titulo"
					name="hero_titulo"
					value={data.settings.hero_titulo}
					required
					maxlength={140}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-1.5 sm:col-span-2">
				<Label for="cfg-sub">Subtítulo del Hero *</Label>
				<textarea
					id="cfg-sub"
					name="hero_subtitulo"
					rows="2"
					required
					maxlength="320"
					class={textareaClass}>{data.settings.hero_subtitulo}</textarea
				>
			</div>
		</div>

		<div class="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
			<div class="flex flex-col gap-1.5">
				<Label for="stat-1">Métrica 1 (Volumen entregado)</Label>
				<Input
					id="stat-1"
					name="stat_piezas_entregadas"
					value={data.settings.stat_piezas_entregadas}
					maxlength={50}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="stat-2">Métrica 2 (Tiempo de respuesta)</Label>
				<Input
					id="stat-2"
					name="stat_tiempo_respuesta"
					value={data.settings.stat_tiempo_respuesta}
					maxlength={50}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="stat-3">Métrica 3 (Pedido mínimo)</Label>
				<Input
					id="stat-3"
					name="stat_minimo_piezas"
					value={data.settings.stat_minimo_piezas}
					maxlength={50}
					class="min-h-11"
				/>
			</div>
		</div>

		<div class="border-t border-border pt-5">
			<h3 class="font-display text-base text-foreground">
				3 Garantías operativas (Reducción de riesgo)
			</h3>
			<div class="mt-3 grid gap-4 md:grid-cols-3">
				{#each [0, 1, 2] as idx (idx)}
					{@const g = data.settings.garantias[idx]}
					<div class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
						<Label for="g-tit-{idx}">Garantía {idx + 1} · Título</Label>
						<Input
							id="g-tit-{idx}"
							name="garantia_titulo_{idx}"
							value={g?.titulo ?? ''}
							maxlength={90}
							class="min-h-10"
						/>
						<Label for="g-desc-{idx}">Descripción</Label>
						<textarea
							id="g-desc-{idx}"
							name="garantia_desc_{idx}"
							rows="3"
							maxlength="260"
							class={textareaClass}>{g?.descripcion ?? ''}</textarea
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="border-t border-border pt-5">
			<Label for="cfg-faqs">
				Preguntas frecuentes B2B (separa cada bloque con una línea en blanco: 1ª línea pregunta, 2ª
				línea respuesta)
			</Label>
			<textarea id="cfg-faqs" name="faqs_text" rows="8" class="{textareaClass} mt-2"
				>{faqsTextInitial}</textarea
			>
		</div>

		<div class="flex justify-end">
			<Button type="submit" disabled={busy} class="min-h-11 px-6">
				{busy ? 'Guardando…' : 'Guardar configuración B2B'}
			</Button>
		</div>
	</form>
{/if}
