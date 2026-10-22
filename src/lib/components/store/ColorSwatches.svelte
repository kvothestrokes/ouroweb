<script lang="ts">
	import type { ColorOption } from '#lib/domain/store-product.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		colors: ColorOption[];
		selected: string | null;
		onselect: (key: string) => void;
		/** Also select on hover (cards on desktop). */
		previewOnHover?: boolean;
		size?: 'sm' | 'md';
		/** Show at most this many; the rest become "+N". */
		max?: number;
	};

	let { colors, selected, onselect, previewOnHover = false, size = 'sm', max }: Props = $props();

	const visible = $derived(max ? colors.slice(0, max) : colors);
	const hidden = $derived(colors.length - visible.length);
</script>

<ul class={cn('flex flex-wrap items-center', size === 'sm' ? '-mx-3' : 'gap-2')}>
	{#each visible as color (color.key)}
		{@const active = color.key === selected}
		<li>
			<button
				type="button"
				aria-label="Color {color.nombre}"
				aria-pressed={active}
				title={color.nombre}
				onclick={() => onselect(color.key)}
				onpointerenter={(event) => {
					if (previewOnHover && event.pointerType === 'mouse') onselect(color.key);
				}}
				class={cn('grid place-items-center rounded-full', 'size-11')}
			>
				<span
					class={cn(
						'block rounded-full border border-foreground/30 transition-shadow',
						size === 'sm' ? 'size-5' : 'size-8',
						active && 'ring-2 ring-gold ring-offset-2 ring-offset-background'
					)}
					style:background-color={color.hex}
				></span>
			</button>
		</li>
	{/each}
	{#if hidden > 0}
		<li class="px-1 text-xs text-muted-foreground">+{hidden}</li>
	{/if}
</ul>
