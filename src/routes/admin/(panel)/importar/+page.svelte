<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		CircleAlert,
		CircleCheck,
		CircleHelp,
		Download,
		FileArchive,
		FileSpreadsheet,
		LoaderCircle,
		RotateCcw,
		Upload,
		X
	} from '@lucide/svelte';
	import { Dialog } from 'bits-ui';
	import { strToU8, zipSync } from 'fflate';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { fitToBudget, readImportPackage } from '#lib/client/import-package.js';
	import { toCsv } from '#lib/domain/csv.js';
	import {
		IMPORT_FIELD_DOCS,
		TEMPLATE_DESIGN,
		TEMPLATE_GUIDE,
		TEMPLATE_PHOTO,
		templateRows,
		type FieldRequirement
	} from '#lib/domain/import-template.js';
	import {
		IMPORT_COLUMNS,
		designKey,
		normalizeFileName,
		parseImportTable,
		type ImportRow,
		type NumberedRow
	} from '#lib/domain/product-import.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Status = 'pendiente' | 'importando' | 'creado' | 'error';
	type Item = {
		line: number;
		nombre: string;
		slug: string;
		row: ImportRow;
		ok: boolean;
		message?: string;
		status: Status;
		id?: string;
	};
	type Phase = 'inicio' | 'leyendo' | 'revision' | 'importando' | 'terminado';

	let phase = $state<Phase>('inicio');
	let error = $state<string | null>(null);
	let fileLabel = $state('');
	let items = $state<Item[]>([]);
	let dragging = $state(false);
	let stopRequested = $state(false);
	let tutorialOpen = $state(false);
	let images = new Map<string, File>();
	let createdDesigns: Record<string, string> = {};

	const validCount = $derived(items.filter((item) => item.ok).length);
	const invalidCount = $derived(items.length - validCount);
	const createdCount = $derived(items.filter((item) => item.status === 'creado').length);
	const retryableCount = $derived(
		items.filter((item) => item.ok && item.status === 'error').length
	);
	const failedItems = $derived(items.filter((item) => !item.ok || item.status === 'error'));
	const processed = $derived(
		items.filter((item) => item.ok && (item.status === 'creado' || item.status === 'error')).length
	);
	const progress = $derived(validCount ? Math.round((processed / validCount) * 100) : 0);

	type ActionResponse = { type: string; data?: Record<string, unknown> };

	async function post(action: string, body: FormData): Promise<ActionResponse> {
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		if (response.status === 413) {
			return { type: 'failure', data: { message: 'La fila pesa demasiado para enviarla.' } };
		}
		try {
			return deserialize(await response.text()) as ActionResponse;
		} catch {
			return { type: 'error' };
		}
	}

	function messageOf(result: ActionResponse, fallback: string): string {
		const message = result.data?.message;
		return typeof message === 'string' ? message : fallback;
	}

	async function handleFiles(list: FileList | null) {
		if (!list?.length || phase === 'leyendo' || phase === 'importando') return;
		error = null;
		items = [];
		phase = 'leyendo';
		const selected = [...list];
		fileLabel = selected.length === 1 ? selected[0].name : `${selected.length} archivos`;

		const pkg = await readImportPackage(selected);
		if (!pkg.ok) return failReading(pkg.message);
		const table = parseImportTable(pkg.value.csv);
		if (!table.ok) return failReading(table.message);
		images = pkg.value.images;
		createdDesigns = {};

		const body = new FormData();
		body.set('rows', JSON.stringify(table.value));
		body.set('files', JSON.stringify([...images.keys()]));
		let result: ActionResponse;
		try {
			result = await post('validar', body);
		} catch {
			return failReading('No pudimos conectar con el servidor. Intenta de nuevo.');
		}
		const report = result.data?.report as
			{ line: number; nombre: string; slug: string; ok: boolean; message?: string }[] | undefined;
		if (result.type !== 'success' || !report) {
			return failReading(messageOf(result, 'No pudimos revisar el archivo. Intenta de nuevo.'));
		}

		const rowByLine = new Map(table.value.map((item) => [item.line, item.row]));
		items = report.map((entry) => ({
			...entry,
			row: rowByLine.get(entry.line) ?? {},
			status: 'pendiente'
		}));
		phase = 'revision';
	}

	function failReading(message: string) {
		error = message;
		phase = 'inicio';
	}

	function filesOf(row: ImportRow, skipDesigns = false) {
		const names = (value: string | undefined) =>
			(value ?? '')
				.split('|')
				.map((name) => name.trim())
				.filter(Boolean)
				.map(normalizeFileName);
		const pick = (list: string[]) =>
			list.map((name) => images.get(name)).filter((file): file is File => !!file);
		const designNames = skipDesigns
			? []
			: [row.diseno_oscura?.trim() ?? '', row.diseno_clara?.trim() ?? '']
					.filter(Boolean)
					.map(normalizeFileName);
		return {
			designs: pick(designNames),
			photos: pick(names(row.fotos))
		};
	}

	async function importRow(item: Item) {
		item.status = 'importando';
		const key = designKey(item.row);
		const reusedDesignId = key ? (createdDesigns[key] ?? null) : null;
		const { designs, photos } = filesOf(item.row, reusedDesignId !== null);
		const fitted = await fitToBudget(designs, photos);
		if (!fitted) {
			item.status = 'error';
			item.message = 'Las imágenes de esta fila pesan más de 4 MB aun reducidas.';
			return;
		}

		const body = new FormData();
		const numbered: NumberedRow = { line: item.line, row: item.row };
		body.set('row', JSON.stringify([numbered]));
		if (reusedDesignId) body.set('reused_design_id', reusedDesignId);
		for (const file of [...fitted.designs, ...fitted.photos]) body.append('archivo', file);

		try {
			const result = await post('importar_fila', body);
			if (result.type === 'success' && typeof result.data?.id === 'string') {
				item.status = 'creado';
				item.id = result.data.id;
				item.message = undefined;
				if (key && typeof result.data?.designId === 'string') {
					createdDesigns[key] = result.data.designId;
				}
			} else {
				item.status = 'error';
				item.message = messageOf(result, 'No pudimos crear el producto. Intenta de nuevo.');
			}
		} catch {
			item.status = 'error';
			item.message = 'Se perdió la conexión con el servidor.';
		}
	}

	async function importAll() {
		if (phase === 'importando') return;
		phase = 'importando';
		stopRequested = false;
		for (const item of items) {
			if (stopRequested) break;
			if (item.ok && item.status === 'pendiente') await importRow(item);
		}
		phase = 'terminado';
	}

	async function retryFailed() {
		if (phase === 'importando') return;
		phase = 'importando';
		stopRequested = false;
		for (const item of items) {
			if (stopRequested) break;
			if (item.ok && item.status === 'error') await importRow(item);
		}
		phase = 'terminado';
	}

	function reset() {
		phase = 'inicio';
		items = [];
		images = new Map();
		createdDesigns = {};
		error = null;
		fileLabel = '';
	}

	function download(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function downloadErrors() {
		const rows = [
			[...IMPORT_COLUMNS, 'error'],
			...failedItems.map((item) => [
				...IMPORT_COLUMNS.map((column) => item.row[column] ?? ''),
				item.message ?? ''
			])
		];
		// The BOM makes Excel open the file as UTF-8.
		download(new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv' }), 'productos-con-errores.csv');
	}

	/** Sample images for the template, drawn on the fly so the template imports as is. */
	async function sampleImage(
		width: number,
		height: number,
		type: string,
		draw: (ctx: OffscreenCanvasRenderingContext2D) => void
	) {
		const canvas = new OffscreenCanvas(width, height);
		draw(canvas.getContext('2d')!);
		return new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.9 })).arrayBuffer());
	}

	function downloadCsvTemplate() {
		// UTF-8 BOM so Excel opens accents and ñ properly without importing steps.
		download(
			new Blob(['\uFEFF' + toCsv(templateRows(data.sample))], { type: 'text/csv;charset=utf-8' }),
			'productos.csv'
		);
	}

	async function downloadTemplate() {
		const design = await sampleImage(800, 800, 'image/png', (ctx) => {
			ctx.fillStyle = 'rgb(201, 162, 39)';
			ctx.beginPath();
			ctx.arc(400, 400, 300, 0, Math.PI * 2);
			ctx.fill();
		});
		const photo = await sampleImage(1200, 900, 'image/jpeg', (ctx) => {
			ctx.fillStyle = 'rgb(240, 236, 228)';
			ctx.fillRect(0, 0, 1200, 900);
			ctx.fillStyle = 'rgb(40, 40, 40)';
			ctx.font = 'bold 72px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Foto de ejemplo', 600, 470);
		});
		const zip = zipSync({
			'carga-productos/productos.csv': strToU8('\uFEFF' + toCsv(templateRows(data.sample))),
			'carga-productos/LEEME.txt': strToU8(TEMPLATE_GUIDE),
			[`carga-productos/imagenes/${TEMPLATE_DESIGN}`]: design,
			[`carga-productos/imagenes/${TEMPLATE_PHOTO}`]: photo
		});
		download(
			new Blob([new Uint8Array(zip)], { type: 'application/zip' }),
			'plantilla-productos.zip'
		);
	}

	const REQUIREMENT_LABELS: Record<FieldRequirement, { label: string; style: string }> = {
		obligatorio: {
			label: 'Obligatorio',
			style: 'border-gold/40 bg-gold-fill/15 text-gold'
		},
		mockup: {
			label: 'Mockup',
			style: 'border-accent/40 bg-accent/15 text-purple-light'
		},
		foto: {
			label: 'Foto',
			style: 'border-accent/40 bg-accent/15 text-purple-light'
		},
		opcional: {
			label: 'Opcional',
			style: 'border-border bg-surface-raised text-muted-foreground'
		}
	};

	beforeNavigate(({ cancel }) => {
		if (
			phase === 'importando' &&
			!confirm('La importación sigue en curso. ¿Salir de todos modos?')
		) {
			cancel();
		}
	});
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (phase === 'importando') event.preventDefault();
	}}
/>

<svelte:head>
	<title>Importar productos · Panel Ouroboros</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="font-display text-2xl text-foreground md:text-3xl">Importar productos</h1>
	<div class="flex flex-wrap items-center gap-2">
		<Button variant="ghost" class="min-h-11" onclick={() => (tutorialOpen = true)}>
			<CircleHelp size={18} strokeWidth={1.75} aria-hidden="true" />
			Cómo funciona
		</Button>
		<Button variant="outline" class="min-h-11" onclick={downloadCsvTemplate}>
			<FileSpreadsheet size={18} strokeWidth={1.75} aria-hidden="true" />
			Plantilla CSV
		</Button>
		<Button variant="outline" class="min-h-11" onclick={downloadTemplate}>
			<Download size={18} strokeWidth={1.75} aria-hidden="true" />
			Ejemplo completo (.zip)
		</Button>
	</div>
</div>
<p class="mt-2 max-w-prose text-muted-foreground">
	Crea muchos productos de una vez subiendo un ZIP con <code>productos.csv</code> y tus imágenes (o el
	CSV junto con las imágenes sueltas). Primero revisamos todo sin guardar nada hasta que confirmes.
</p>

<Dialog.Root bind:open={tutorialOpen}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
		>
			<div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div>
					<Dialog.Title class="font-display text-lg text-foreground">
						Cómo cargar tus productos en 4 pasos
					</Dialog.Title>
					<Dialog.Description class="mt-1 text-sm text-muted-foreground">
						Prepara tu hoja de cálculo y tus imágenes sin preocuparte por perder cambios.
					</Dialog.Description>
				</div>
				<Dialog.Close
					class="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
					aria-label="Cerrar tutorial"
				>
					<X size={20} strokeWidth={1.75} />
				</Dialog.Close>
			</div>

			<div class="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
				<ol class="space-y-3">
					<li class="flex gap-3 rounded-lg border border-border bg-surface-raised/50 p-3.5">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>
							1
						</span>
						<div>
							<p class="font-medium text-foreground">Descarga la plantilla</p>
							<p class="mt-0.5 text-muted-foreground">
								Baja el archivo <code>productos.csv</code> para abrirlo en Excel, Numbers o Google
								Sheets, o el paquete <code>.zip</code> que ya trae imágenes de prueba.
							</p>
						</div>
					</li>
					<li class="flex gap-3 rounded-lg border border-border bg-surface-raised/50 p-3.5">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>
							2
						</span>
						<div>
							<p class="font-medium text-foreground">Llena una fila por producto</p>
							<p class="mt-0.5 text-muted-foreground">
								En las columnas de imagen escribe solo el nombre del archivo (ej.
								<code>calavera.png</code>). Si varios productos usan el mismo diseño PNG, el sistema
								lo sube una sola vez y lo comparte.
							</p>
						</div>
					</li>
					<li class="flex gap-3 rounded-lg border border-border bg-surface-raised/50 p-3.5">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>
							3
						</span>
						<div>
							<p class="font-medium text-foreground">Junta el CSV con tus imágenes</p>
							<p class="mt-0.5 text-muted-foreground">
								Comprime tu <code>productos.csv</code> y la carpeta de imágenes en un archivo
								<code>.zip</code> (o selecciona el CSV y las imágenes sueltas al mismo tiempo).
							</p>
						</div>
					</li>
					<li class="flex gap-3 rounded-lg border border-border bg-surface-raised/50 p-3.5">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
						>
							4
						</span>
						<div>
							<p class="font-medium text-foreground">Revisa el diagnóstico y confirma</p>
							<p class="mt-0.5 text-muted-foreground">
								Primero verás qué filas están listas y cuáles tienen algún dato por corregir. Nada
								se guarda hasta que pulses <strong>Importar</strong>.
							</p>
						</div>
					</li>
				</ol>
			</div>

			<div
				class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4"
			>
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" class="min-h-11" onclick={downloadCsvTemplate}>
						<FileSpreadsheet size={18} strokeWidth={1.75} aria-hidden="true" />
						Descargar CSV
					</Button>
					<Button variant="outline" class="min-h-11" onclick={downloadTemplate}>
						<Download size={18} strokeWidth={1.75} aria-hidden="true" />
						Descargar ZIP de ejemplo
					</Button>
				</div>
				<Button class="min-h-11" onclick={() => (tutorialOpen = false)}>Entendido</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<FormMessage {error} class="mt-6" />

{#if phase === 'inicio' || phase === 'leyendo'}
	<label
		class="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors {dragging
			? 'border-primary bg-surface-raised'
			: 'border-border bg-card hover:bg-surface-raised'}"
		ondragover={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(event) => {
			event.preventDefault();
			dragging = false;
			handleFiles(event.dataTransfer?.files ?? null);
		}}
	>
		{#if phase === 'leyendo'}
			<LoaderCircle
				class="animate-spin text-muted-foreground"
				size={32}
				strokeWidth={1.5}
				aria-hidden="true"
			/>
			<span class="font-medium text-foreground">Revisando {fileLabel}…</span>
		{:else}
			<FileArchive class="text-muted-foreground" size={32} strokeWidth={1.5} aria-hidden="true" />
			<span class="font-medium text-foreground">Arrastra aquí el ZIP o haz clic para elegirlo</span>
			<span class="text-sm text-muted-foreground">
				También puedes elegir el CSV junto con las imágenes sueltas. Máximo 500 productos.
			</span>
		{/if}
		<input
			type="file"
			class="sr-only"
			multiple
			accept=".zip,.csv,image/png,image/jpeg,image/webp"
			disabled={phase === 'leyendo'}
			onchange={(event) => {
				handleFiles(event.currentTarget.files);
				event.currentTarget.value = '';
			}}
		/>
	</label>
{:else}
	<section class="mt-6 rounded-xl border border-border bg-card p-5" aria-live="polite">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="font-medium text-foreground">{fileLabel}</p>
				<p class="text-sm text-muted-foreground">
					{#if phase === 'revision'}
						{validCount} listos para importar{#if invalidCount}, {invalidCount} con errores{/if}.
					{:else}
						{createdCount} creados de {validCount}{#if failedItems.length}
							· {failedItems.length} con errores{/if}.
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if phase === 'revision'}
					<Button variant="outline" class="min-h-11" onclick={reset}>
						<RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
						Elegir otro archivo
					</Button>
					<Button class="min-h-11" disabled={validCount === 0} onclick={importAll}>
						<Upload size={18} strokeWidth={1.75} aria-hidden="true" />
						Importar {validCount}
						{validCount === 1 ? 'producto' : 'productos'}
					</Button>
				{:else if phase === 'importando'}
					<Button
						variant="outline"
						class="min-h-11"
						disabled={stopRequested}
						onclick={() => (stopRequested = true)}
					>
						{stopRequested ? 'Deteniendo…' : 'Detener'}
					</Button>
				{:else}
					{#if retryableCount > 0}
						<Button class="min-h-11" onclick={retryFailed}>
							<RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
							Reintentar {retryableCount}
							{retryableCount === 1 ? 'fallido' : 'fallidos'}
						</Button>
					{/if}
					{#if failedItems.length}
						<Button variant="outline" class="min-h-11" onclick={downloadErrors}>
							<Download size={18} strokeWidth={1.75} aria-hidden="true" />
							Descargar filas con error
						</Button>
					{/if}
					<Button variant="outline" class="min-h-11" onclick={reset}>Nueva carga</Button>
					<Button href={resolve('/admin/(panel)/productos')} class="min-h-11">Ver productos</Button>
				{/if}
			</div>
		</div>

		{#if phase === 'importando' || phase === 'terminado'}
			<div
				class="mt-4 h-2 overflow-hidden rounded-full bg-surface-raised"
				role="progressbar"
				aria-label="Avance de la importación"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={progress}
			>
				<div class="h-full bg-primary transition-[width]" style:width="{progress}%"></div>
			</div>
		{/if}
		{#if phase === 'terminado' && createdCount}
			<p class="mt-3 text-sm text-success">
				Listo: {createdCount}
				{createdCount === 1 ? 'producto creado' : 'productos creados'}. Revisa y activa los que se
				importaron como borrador.
			</p>
		{/if}
	</section>

	<div class="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
		<table class="w-full min-w-[640px] text-sm">
			<thead class="text-left text-muted-foreground">
				<tr class="border-b border-border">
					<th scope="col" class="px-4 py-3 font-medium">Línea</th>
					<th scope="col" class="px-4 py-3 font-medium">Producto</th>
					<th scope="col" class="px-4 py-3 font-medium">Estado</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item (item.line)}
					<tr class="h-12 border-b border-border last:border-0">
						<td class="px-4 py-2 text-muted-foreground tabular-nums">{item.line}</td>
						<td class="px-4 py-2">
							<p class="font-medium text-foreground">{item.nombre || '—'}</p>
							<p class="text-xs text-muted-foreground">{item.slug}</p>
						</td>
						<td class="px-4 py-2">
							{#if !item.ok || item.status === 'error'}
								<span class="inline-flex items-start gap-1.5 text-danger">
									<CircleAlert
										class="mt-0.5 shrink-0"
										size={16}
										strokeWidth={1.75}
										aria-hidden="true"
									/>
									{item.message}
								</span>
							{:else if item.status === 'creado' && item.id}
								<a
									href={resolve('/admin/(panel)/productos/[id]', { id: item.id })}
									class="inline-flex items-center gap-1.5 text-success hover:underline"
								>
									<CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
									Creado
								</a>
							{:else if item.status === 'importando'}
								<span class="inline-flex items-center gap-1.5 text-muted-foreground">
									<LoaderCircle
										class="animate-spin"
										size={16}
										strokeWidth={1.75}
										aria-hidden="true"
									/>
									Subiendo…
								</span>
							{:else}
								<span class="text-muted-foreground">Listo para importar</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<section class="mt-10 space-y-6" aria-labelledby="guia-columnas">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="guia-columnas" class="font-display text-xl text-foreground">
				Guía de columnas del CSV
			</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Usa estos nombres de columna en la primera fila de tu archivo. El orden no importa.
			</p>
		</div>
		<Button variant="outline" class="min-h-11" onclick={downloadCsvTemplate}>
			<FileSpreadsheet size={18} strokeWidth={1.75} aria-hidden="true" />
			Descargar plantilla CSV
		</Button>
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-border bg-card p-4 text-sm">
			<h3 class="font-display text-sm text-foreground">Categorías disponibles (slug)</h3>
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each data.reference.categorias as category (category.slug)}
					<code
						class="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-xs text-foreground"
					>
						{category.slug}
					</code>
				{:else}
					<span class="text-xs text-muted-foreground">Todavía no hay categorías.</span>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border border-border bg-card p-4 text-sm">
			<h3 class="font-display text-sm text-foreground">Colecciones disponibles (slug)</h3>
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each data.reference.colecciones as collection (collection.slug)}
					<code
						class="rounded-md border border-border bg-surface-raised px-2 py-0.5 text-xs text-foreground"
					>
						{collection.slug}
					</code>
				{:else}
					<span class="text-xs text-muted-foreground">Todavía no hay colecciones.</span>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border border-border bg-card p-4 text-sm">
			<h3 class="font-display text-sm text-foreground">Prendas, tallas y colores</h3>
			<div class="mt-2 space-y-2 text-xs">
				{#each data.reference.prendas as prenda (prenda.nombre)}
					<div>
						<p class="font-medium text-foreground">
							<code>{prenda.nombre}</code>
							<span class="text-muted-foreground">· Tallas: {prenda.tallas.join(', ') || '—'}</span>
						</p>
						<p class="mt-0.5 text-muted-foreground">
							Colores: {prenda.colores.join(' | ') || '—'}
						</p>
					</div>
				{:else}
					<span class="text-muted-foreground">Todavía no hay tipos de prenda.</span>
				{/each}
			</div>
		</div>
	</div>

	<div class="overflow-x-auto rounded-xl border border-border bg-card">
		<table class="w-full min-w-[640px] text-sm">
			<thead class="text-left text-muted-foreground">
				<tr class="border-b border-border">
					<th scope="col" class="px-4 py-3 font-medium">Columna</th>
					<th scope="col" class="px-4 py-3 font-medium">Cuándo usarla</th>
					<th scope="col" class="px-4 py-3 font-medium">Qué escribir</th>
					<th scope="col" class="px-4 py-3 font-medium">Ejemplo</th>
				</tr>
			</thead>
			<tbody>
				{#each IMPORT_FIELD_DOCS as field (field.column)}
					{@const badge = REQUIREMENT_LABELS[field.requirement]}
					<tr class="h-12 border-b border-border last:border-0">
						<td class="px-4 py-2.5 font-medium whitespace-nowrap text-foreground">
							<code>{field.column}</code>
						</td>
						<td class="px-4 py-2.5 whitespace-nowrap">
							<span
								class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {badge.style}"
							>
								{badge.label}
							</span>
						</td>
						<td class="px-4 py-2.5 text-muted-foreground">{field.description}</td>
						<td class="px-4 py-2.5 whitespace-nowrap">
							<code
								class="rounded border border-border bg-surface-raised px-2 py-0.5 text-xs text-foreground"
							>
								{field.example}
							</code>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
