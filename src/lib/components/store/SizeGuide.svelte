<script lang="ts">
	import Ruler from '@lucide/svelte/icons/ruler';
	import type { SizeGuide } from '#lib/domain/garment-type.js';
	import Panel from './Panel.svelte';

	type Props = { guide: SizeGuide; sizes: string[]; garment: string };

	let { guide, sizes, garment }: Props = $props();

	let open = $state(false);
	const rows = $derived(sizes.filter((size) => guide[size]));
</script>

<button
	type="button"
	onclick={() => (open = true)}
	class="inline-flex min-h-11 items-center gap-1.5 text-sm text-purple-light hover:underline"
>
	<Ruler size={16} stroke-width={1.75} />
	Guía de tallas
</button>

<Panel
	bind:open
	title="Guía de tallas"
	description="{garment}: medidas de la prenda en centímetros."
>
	{#if rows.length}
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border text-left text-muted-foreground">
					<th scope="col" class="py-2 font-medium">Talla</th>
					<th scope="col" class="py-2 text-right font-medium">Ancho</th>
					<th scope="col" class="py-2 text-right font-medium">Largo</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as size (size)}
					<tr class="border-b border-border/60">
						<th scope="row" class="py-3 text-left font-medium">{size}</th>
						<td class="py-3 text-right tabular-nums">{guide[size].ancho_cm} cm</td>
						<td class="py-3 text-right tabular-nums">{guide[size].largo_cm} cm</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="mt-4 text-xs text-muted-foreground">
			Mide de axila a axila (ancho) y del hombro al borde inferior (largo) una playera que te quede
			bien y compárala con la tabla.
		</p>
	{:else}
		<!-- TODO(negocio): medidas reales de la guía de tallas (spec, sección 13). -->
		<p class="text-sm text-muted-foreground">
			Estamos midiendo nuestras prendas. Pregúntanos por WhatsApp y te ayudamos a elegir tu talla.
		</p>
	{/if}
</Panel>
