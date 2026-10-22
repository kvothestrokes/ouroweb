<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { Label } from '#lib/components/ui/label/index.js';
	import { downscaleOnPick } from '#lib/client/downscale-image.js';
	import { MAX_DESIGN_WIDTH } from '#lib/domain/design-variant.js';

	type Props = {
		name: 'oscura' | 'clara';
		label: string;
		hint: string;
		/** The design already has this version (edit page). */
		current?: boolean;
	};

	let { name, label, hint, current = false }: Props = $props();
	const id = $derived(`archivo-${name}`);
</script>

<div class="flex flex-col gap-2">
	<Label for={id}>{label}</Label>
	<input
		{id}
		{name}
		type="file"
		accept="image/png"
		{@attach downscaleOnPick(MAX_DESIGN_WIDTH)}
		class="min-h-11 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-foreground"
	/>
	<p class="text-xs text-muted-foreground">
		{#if current}
			<span class="inline-flex items-center gap-1 text-success">
				<Check size={14} strokeWidth={1.75} aria-hidden="true" /> Ya tiene esta versión.
			</span>
			Sube otra solo si quieres reemplazarla.
		{:else}
			{hint}
		{/if}
	</p>
</div>
