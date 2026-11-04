<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import type { SizeBreakdownItem } from '#lib/domain/custom-request.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		tallas: string[];
		breakdown: SizeBreakdownItem[];
		onchange?: (items: SizeBreakdownItem[]) => void;
	};

	let { tallas, breakdown = $bindable([]), onchange }: Props = $props();

	function getQty(talla: string): number {
		const found = breakdown.find((item) => item.talla === talla);
		return found ? found.cantidad : 0;
	}

	function updateQty(talla: string, delta: number) {
		const current = getQty(talla);
		const next = Math.max(0, Math.min(999, current + delta));
		const updated = breakdown.filter((item) => item.talla !== talla);
		if (next > 0) {
			updated.push({ talla, cantidad: next });
		}
		// Sort by original tallas order
		updated.sort((a, b) => {
			const idxA = tallas.indexOf(a.talla);
			const idxB = tallas.indexOf(b.talla);
			return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
		});
		breakdown = updated;
		onchange?.(updated);
	}

	const totalPieces = $derived(breakdown.reduce((sum, item) => sum + item.cantidad, 0));
</script>

<div class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
	<div class="flex items-center justify-between">
		<div>
			<span class="text-sm font-semibold text-foreground">Elige tus tallas y cantidades</span>
			<p class="text-xs text-muted-foreground">
				Puedes combinar diferentes tallas para tu encargo.
			</p>
		</div>
		<div
			class={cn(
				'rounded-full px-3 py-1 text-xs font-bold transition-colors',
				totalPieces > 0 ? 'bg-gold-fill text-on-gold' : 'bg-surface-raised text-muted-foreground'
			)}
		>
			{totalPieces}
			{totalPieces === 1 ? 'pieza' : 'piezas'}
		</div>
	</div>

	<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
		{#each tallas as talla (talla)}
			{@const qty = getQty(talla)}
			<div
				class={cn(
					'flex flex-col items-center justify-between rounded-xl border p-2.5 transition-all',
					qty > 0
						? 'border-gold bg-gold-fill/5 shadow-sm'
						: 'border-border bg-surface-raised/40 hover:border-border/80'
				)}
			>
				<span class="font-display text-sm font-bold tracking-wider text-foreground">
					{talla}
				</span>

				<div class="mt-2 flex items-center gap-2">
					<button
						type="button"
						onclick={() => updateQty(talla, -1)}
						disabled={qty === 0}
						aria-label="Restar 1 pieza talla {talla}"
						class="grid size-7 place-items-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:border-gold disabled:opacity-30"
					>
						<Minus size={13} />
					</button>

					<span class="w-6 text-center text-sm font-bold text-foreground tabular-nums">
						{qty}
					</span>

					<button
						type="button"
						onclick={() => updateQty(talla, 1)}
						aria-label="Sumar 1 pieza talla {talla}"
						class="grid size-7 place-items-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:border-gold"
					>
						<Plus size={13} />
					</button>
				</div>
			</div>
		{/each}
	</div>

	{#if totalPieces === 0}
		<p class="text-xs text-warning">Selecciona al menos 1 pieza en alguna talla para tu encargo.</p>
	{/if}
</div>
