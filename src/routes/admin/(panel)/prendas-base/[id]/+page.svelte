<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, LoaderCircle, Trash2 } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { MIN_PRINT_WIDTH } from '#lib/domain/print-area.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Editable copies of the saved area; they reset when the saved data changes.
	let x = $derived(data.base.area.x);
	let y = $derived(data.base.area.y);
	let ancho = $derived(data.base.area.ancho);

	const photoWidth = $derived(data.photo.width);
	const photoHeight = $derived(data.photo.height);
	// The design height depends on each design; the box shows the sample design's height.
	const boxHeight = $derived(Math.round(ancho / data.designRatio));
	const valid = $derived(
		[x, y, ancho].every(Number.isInteger) &&
			x >= 0 &&
			y >= 0 &&
			ancho >= MIN_PRINT_WIDTH &&
			x + ancho <= photoWidth &&
			y < photoHeight
	);

	let saving = $state(false);
	let stage = $state<HTMLDivElement>();

	type Drag = {
		mode: 'move' | 'resize';
		startX: number;
		startY: number;
		x0: number;
		y0: number;
		ancho0: number;
		scale: number;
	};
	let drag: Drag | null = null;

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	function startDrag(mode: Drag['mode'], event: PointerEvent) {
		if (!stage) return;
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		drag = {
			mode,
			startX: event.clientX,
			startY: event.clientY,
			x0: x,
			y0: y,
			ancho0: ancho,
			scale: photoWidth / stage.clientWidth
		};
	}

	function onDrag(event: PointerEvent) {
		if (!drag) return;
		const dx = (event.clientX - drag.startX) * drag.scale;
		const dy = (event.clientY - drag.startY) * drag.scale;
		if (drag.mode === 'move') {
			x = clamp(Math.round(drag.x0 + dx), 0, photoWidth - ancho);
			y = clamp(Math.round(drag.y0 + dy), 0, photoHeight - 1);
		} else {
			ancho = clamp(Math.round(drag.ancho0 + dx), MIN_PRINT_WIDTH, photoWidth - x);
		}
	}

	function endDrag() {
		if (!drag) return;
		drag = null;
		refreshPreview();
	}

	function numberInput(event: Event & { currentTarget: HTMLInputElement }): number {
		return event.currentTarget.valueAsNumber;
	}

	// The preview follows the saved area and refreshes when a drag ends or a number is committed.
	let previewArea = $derived<{ x: number; y: number; ancho: number } | null>(data.base.area);

	function refreshPreview() {
		previewArea = valid ? { x, y, ancho } : null;
	}

	const photoSrc = $derived(
		`${resolve('/admin/(panel)/prendas-base/foto/[tipo]/[color]', {
			tipo: data.base.tipo,
			color: data.base.color
		})}?w=1000`
	);
	const previewSrc = $derived(
		previewArea &&
			`${resolve('/admin/(panel)/prendas-base/[id]/vista-previa', { id: data.base.id })}?x=${previewArea.x}&y=${previewArea.y}&ancho=${previewArea.ancho}`
	);
</script>

<svelte:head>
	<title>{data.base.tipoNombre} {data.base.colorNombre} · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/prendas-base')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Prendas base
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">
	{data.base.tipoNombre} · {data.base.colorNombre}
</h1>

{#if form?.message}
	<p
		role="alert"
		class="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
	>
		{form.message}
	</p>
{:else if form?.saved}
	<p
		role="status"
		class="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
	>
		Cambios guardados{form.alsoUpdated
			? `; el área también se copió a ${form.alsoUpdated} colores más`
			: ''}.
	</p>
{/if}

<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<div class="flex flex-col gap-6">
		<div
			bind:this={stage}
			class="relative overflow-hidden rounded-xl border border-border bg-surface-raised select-none"
			style:aspect-ratio="{photoWidth} / {photoHeight}"
		>
			<img
				src={photoSrc}
				alt="{data.base.tipoNombre} {data.base.colorNombre.toLowerCase()} lisa"
				class="pointer-events-none size-full"
				draggable="false"
			/>
			<div
				aria-hidden="true"
				class={[
					'absolute cursor-move touch-none border-2 border-dashed bg-accent/15',
					valid ? 'border-purple-light' : 'border-danger'
				]}
				style:left="{(x / photoWidth) * 100}%"
				style:top="{(y / photoHeight) * 100}%"
				style:width="{(ancho / photoWidth) * 100}%"
				style:height="{(boxHeight / photoHeight) * 100}%"
				onpointerdown={(event) => startDrag('move', event)}
				onpointermove={onDrag}
				onpointerup={endDrag}
				onpointercancel={endDrag}
			>
				<span
					role="presentation"
					class="absolute -right-2.5 -bottom-2.5 size-5 cursor-nwse-resize touch-none rounded-full border-2 border-background bg-purple-light"
					onpointerdown={(event) => startDrag('resize', event)}
					onpointermove={onDrag}
					onpointerup={endDrag}
					onpointercancel={endDrag}
				></span>
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			Arrastra el recuadro para moverlo y el punto de la esquina para cambiar el ancho. El alto
			depende de cada diseño; aquí se ve el del diseño de muestra.
		</p>

		<section aria-labelledby="preview-title">
			<h2 id="preview-title" class="font-display text-lg text-foreground">Vista previa</h2>
			<div class="mt-3 max-w-md overflow-hidden rounded-xl border border-border bg-surface-raised">
				{#if previewSrc}
					<img
						src={previewSrc}
						alt="Vista previa con un diseño de muestra"
						class="aspect-square w-full"
						draggable="false"
					/>
				{:else}
					<div
						class="flex aspect-square items-center justify-center p-6 text-center text-sm text-muted-foreground"
					>
						Corrige el área para ver la vista previa.
					</div>
				{/if}
			</div>
		</section>
	</div>

	<div class="flex flex-col gap-6">
		<form
			method="POST"
			action="?/guardar"
			class="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					saving = false;
				};
			}}
		>
			<div class="flex flex-col gap-2">
				<Label for="color_nombre">Nombre del color</Label>
				<Input
					id="color_nombre"
					name="color_nombre"
					required
					maxlength={40}
					value={data.base.colorNombre}
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="color_hex">Color de muestra</Label>
				<input
					id="color_hex"
					name="color_hex"
					type="color"
					value={data.base.colorHex}
					class="h-11 w-20 cursor-pointer rounded-md border border-border bg-transparent"
				/>
			</div>

			<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
				<input
					type="checkbox"
					name="es_clara"
					checked={data.base.esClara}
					class="size-5 accent-[var(--gold)]"
				/>
				Prenda clara (usa la versión del diseño para prendas claras)
			</label>

			<fieldset class="flex flex-col gap-3">
				<legend class="text-sm font-medium text-foreground"
					>Área de impresión (px de la foto)</legend
				>
				<div class="grid grid-cols-3 gap-3">
					<div class="flex flex-col gap-1">
						<Label for="x" class="text-xs text-muted-foreground">X</Label>
						<Input
							id="x"
							name="x"
							type="number"
							min={0}
							max={photoWidth - 1}
							value={x}
							oninput={(event) => (x = numberInput(event))}
							onchange={refreshPreview}
							class="min-h-11 tabular-nums"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<Label for="y" class="text-xs text-muted-foreground">Y</Label>
						<Input
							id="y"
							name="y"
							type="number"
							min={0}
							max={photoHeight - 1}
							value={y}
							oninput={(event) => (y = numberInput(event))}
							onchange={refreshPreview}
							class="min-h-11 tabular-nums"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<Label for="ancho" class="text-xs text-muted-foreground">Ancho</Label>
						<Input
							id="ancho"
							name="ancho"
							type="number"
							min={MIN_PRINT_WIDTH}
							max={photoWidth}
							value={ancho}
							oninput={(event) => (ancho = numberInput(event))}
							onchange={refreshPreview}
							class="min-h-11 tabular-nums"
						/>
					</div>
				</div>
				<p class="text-xs text-muted-foreground">La foto mide {photoWidth} × {photoHeight} px.</p>
			</fieldset>

			<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
				<input type="checkbox" name="aplicar_a_todos" class="size-5 accent-[var(--gold)]" />
				Usar esta área en todos los colores de {data.base.tipoNombre.toLowerCase()}
			</label>

			<Button type="submit" size="lg" class="min-h-11" disabled={saving || !valid}>
				{#if saving}
					<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
					Guardando…
				{:else}
					Guardar cambios
				{/if}
			</Button>
		</form>

		<form
			method="POST"
			action="?/eliminar"
			use:enhance={({ cancel }) => {
				if (!confirm(`¿Eliminar ${data.base.colorNombre} de ${data.base.tipoNombre}?`)) cancel();
			}}
		>
			<button
				type="submit"
				class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
			>
				<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
				Eliminar este color
			</button>
		</form>
	</div>
</div>
