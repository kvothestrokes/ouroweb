<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatMoney } from '#lib/domain/money.js';

	type Props = {
		subtotal: number;
		descMayoreo: number;
		/** null = to be quoted by WhatsApp. */
		envio: number | null;
		personalizacion: boolean;
		children?: Snippet;
	};

	let { subtotal, descMayoreo, envio, personalizacion, children }: Props = $props();

	const total = $derived(subtotal - descMayoreo + (envio ?? 0));
	const pending = $derived(envio === null || personalizacion);
</script>

<section
	aria-labelledby="resumen"
	class="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
>
	<h2 id="resumen" class="text-lg">Resumen</h2>
	<dl class="flex flex-col gap-2 text-sm">
		<div class="flex justify-between gap-4">
			<dt class="text-muted-foreground">Subtotal</dt>
			<dd class="tabular-nums">{formatMoney(subtotal)}</dd>
		</div>
		{#if descMayoreo}
			<div class="flex justify-between gap-4 text-success">
				<dt>Precio de mayoreo</dt>
				<dd class="tabular-nums">−{formatMoney(descMayoreo)}</dd>
			</div>
		{/if}
		<div class="flex justify-between gap-4">
			<dt class="text-muted-foreground">Envío</dt>
			<dd class={envio === null ? 'text-muted-foreground' : 'tabular-nums'}>
				{envio === null ? 'Por cotizar' : envio === 0 ? 'Sin costo' : formatMoney(envio)}
			</dd>
		</div>
		{#if personalizacion}
			<div class="flex justify-between gap-4">
				<dt class="text-muted-foreground">Personalización</dt>
				<dd class="text-muted-foreground">Por cotizar</dd>
			</div>
		{/if}
		<div class="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-3">
			<dt class="font-medium">{pending ? 'Total estimado' : 'Total'}</dt>
			<dd class="text-xl font-semibold text-gold tabular-nums">{formatMoney(total)}</dd>
		</div>
	</dl>
	{#if pending}
		<p class="text-xs text-muted-foreground">
			Te confirmamos el total final por WhatsApp antes de pedirte el anticipo.
		</p>
	{/if}
	{@render children?.()}
</section>
