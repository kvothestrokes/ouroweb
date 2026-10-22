<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowDown, ArrowLeft, ArrowUp, LoaderCircle, Plus, Trash2, X } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { centsToInput } from '#lib/domain/money.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);

	type Row = { key: number; talla: string; recargo: string; ancho: string; largo: string };
	let nextKey = 0;

	function rowsFrom(type: typeof data.type): Row[] {
		// A $state proxy, so typed values follow their row when rows move.
		const fresh: Row[] = $state(
			type.tallas.map((talla) => ({
				key: nextKey++,
				talla,
				recargo: centsToInput(type.recargos[talla] ?? null),
				ancho: type.guia[talla] ? String(type.guia[talla].ancho_cm) : '',
				largo: type.guia[talla] ? String(type.guia[talla].largo_cm) : ''
			}))
		);
		return fresh;
	}

	// Editable rows; they reset to the saved sizes whenever the data reloads.
	const rows = $derived(rowsFrom(data.type));

	// `rows` is a $state proxy: mutate it in place.
	function addRow() {
		rows.push({ key: nextKey++, talla: '', recargo: '', ancho: '', largo: '' });
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
	}

	function moveRow(index: number, offset: -1 | 1) {
		const target = index + offset;
		if (target < 0 || target >= rows.length) return;
		[rows[index], rows[target]] = [rows[target], rows[index]];
	}
</script>

<svelte:head>
	<title>{data.type.nombre} · Tallas y precios · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/tipos-de-prenda')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Tallas y precios
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">{data.type.nombre}</h1>

<FormMessage error={form?.message} success={form?.success} class="mt-4" />

<form
	method="POST"
	action="?/guardar"
	class="mt-6 flex max-w-4xl flex-col gap-8"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="precios">
		<h2 id="precios" class="font-display text-lg text-foreground">Precio</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Lo heredan todos los productos de {data.type.nombre.toLowerCase()} que no tengan precio propio.
		</p>
		<div class="mt-4 grid gap-4 sm:grid-cols-3">
			<div class="flex flex-col gap-2">
				<Label for="precio_normal">Precio normal (MXN)</Label>
				<Input
					id="precio_normal"
					name="precio_normal"
					inputmode="decimal"
					placeholder="Sin definir"
					value={centsToInput(data.type.precioNormal)}
					class="min-h-11 tabular-nums"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="precio_mayoreo">Precio de mayoreo (MXN)</Label>
				<Input
					id="precio_mayoreo"
					name="precio_mayoreo"
					inputmode="decimal"
					placeholder="Sin definir"
					value={centsToInput(data.type.precioMayoreo)}
					class="min-h-11 tabular-nums"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="mayoreo_cantidad_min">Mayoreo desde (piezas)</Label>
				<Input
					id="mayoreo_cantidad_min"
					name="mayoreo_cantidad_min"
					type="number"
					min={2}
					placeholder="Sin definir"
					value={data.type.mayoreoMin ?? ''}
					class="min-h-11 tabular-nums"
				/>
			</div>
		</div>
	</section>

	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="tallas">
		<h2 id="tallas" class="font-display text-lg text-foreground">Tallas</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			En el orden en que aparecen en la tienda. El recargo se suma al precio; las medidas forman la
			guía de tallas.
		</p>

		<div class="relative mt-4 overflow-x-auto">
			<table class="w-full min-w-[36rem] text-sm">
				<thead>
					<tr class="text-left text-xs text-muted-foreground">
						<th class="pb-2 font-medium" scope="col">Talla</th>
						<th class="pb-2 font-medium" scope="col">Recargo (MXN)</th>
						<th class="pb-2 font-medium" scope="col">Ancho (cm)</th>
						<th class="pb-2 font-medium" scope="col">Largo (cm)</th>
						<th class="pb-2" scope="col"><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, index (row.key)}
						<tr>
							<td class="py-1 pr-2">
								<Input
									name="talla"
									aria-label="Talla {index + 1}"
									bind:value={row.talla}
									maxlength={5}
									class="min-h-11 w-20 uppercase"
								/>
							</td>
							<td class="py-1 pr-2">
								<Input
									name="recargo"
									aria-label="Recargo de la talla {index + 1}"
									inputmode="decimal"
									placeholder="0"
									bind:value={row.recargo}
									class="min-h-11 w-28 tabular-nums"
								/>
							</td>
							<td class="py-1 pr-2">
								<Input
									name="ancho"
									aria-label="Ancho de la talla {index + 1}"
									inputmode="decimal"
									bind:value={row.ancho}
									class="min-h-11 w-24 tabular-nums"
								/>
							</td>
							<td class="py-1 pr-2">
								<Input
									name="largo"
									aria-label="Largo de la talla {index + 1}"
									inputmode="decimal"
									bind:value={row.largo}
									class="min-h-11 w-24 tabular-nums"
								/>
							</td>
							<td class="py-1">
								<div class="flex">
									<button
										type="button"
										onclick={() => moveRow(index, -1)}
										disabled={index === 0}
										aria-label="Subir la talla {index + 1}"
										class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground disabled:opacity-30"
									>
										<ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
									</button>
									<button
										type="button"
										onclick={() => moveRow(index, 1)}
										disabled={index === rows.length - 1}
										aria-label="Bajar la talla {index + 1}"
										class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground disabled:opacity-30"
									>
										<ArrowDown size={18} strokeWidth={1.75} aria-hidden="true" />
									</button>
									<button
										type="button"
										onclick={() => removeRow(index)}
										aria-label="Quitar la talla {index + 1}"
										class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
									>
										<X size={18} strokeWidth={1.75} aria-hidden="true" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<button
			type="button"
			onclick={addRow}
			class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-purple-light hover:bg-surface-raised"
		>
			<Plus size={18} strokeWidth={1.75} aria-hidden="true" />
			Agregar talla
		</button>
	</section>

	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{#if saving}
				<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
				Guardando…
			{:else}
				Guardar cambios
			{/if}
		</Button>
	</div>
</form>

<form
	method="POST"
	action="?/eliminar"
	class="mt-8"
	use:enhance={({ cancel }) => {
		if (!confirm(`¿Eliminar ${data.type.nombre}?`)) cancel();
	}}
>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
	>
		<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
		Eliminar tipo de prenda
	</button>
</form>
