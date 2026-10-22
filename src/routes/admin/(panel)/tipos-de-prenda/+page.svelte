<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { formatMoney } from '#lib/domain/money.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Tallas y precios · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Tallas y precios</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Cada tipo de prenda define sus tallas, el recargo de las tallas grandes, la guía de medidas y el
	precio que heredan todos sus productos.
</p>

<FormMessage error={form?.message} class="mt-6" />

<ul class="mt-6 flex flex-col gap-3">
	{#each data.types as type (type.id)}
		<li>
			<a
				href={resolve('/admin/(panel)/tipos-de-prenda/[id]', { id: type.id })}
				class="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-raised"
			>
				<div class="min-w-0 flex-1">
					<p class="font-medium text-foreground">{type.nombre}</p>
					<p class="mt-1 text-sm text-muted-foreground">{type.tallas.join(' · ')}</p>
				</div>
				<div class="shrink-0 text-right text-sm">
					{#if type.precio_normal !== null}
						<p class="font-semibold text-gold tabular-nums">{formatMoney(type.precio_normal)}</p>
						{#if type.precio_mayoreo !== null}
							<p class="text-xs text-muted-foreground tabular-nums">
								Mayoreo {formatMoney(type.precio_mayoreo)}
								{type.mayoreo_cantidad_min ? `desde ${type.mayoreo_cantidad_min} pzas` : ''}
							</p>
						{/if}
					{:else}
						<p class="text-warning">Sin precio</p>
					{/if}
				</div>
				<ChevronRight size={18} strokeWidth={1.75} class="shrink-0 text-muted-foreground" />
			</a>
		</li>
	{/each}
</ul>

<form
	method="POST"
	action="?/crear"
	class="mt-8 flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-end"
	use:enhance
>
	<div class="flex flex-1 flex-col gap-2">
		<Label for="nombre">Nuevo tipo de prenda</Label>
		<Input
			id="nombre"
			name="nombre"
			required
			maxlength={40}
			placeholder="Ej. Sudadera oversize"
			class="min-h-11"
		/>
	</div>
	<Button type="submit" class="min-h-11">Crear</Button>
</form>
