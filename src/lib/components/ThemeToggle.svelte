<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { theme } from '#lib/stores/theme.svelte.js';
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();

	$effect(() => theme.sync());

	const night = $derived(theme.current === 'noche');
</script>

<button
	type="button"
	onclick={() => theme.toggle()}
	aria-label={night ? 'Cambiar a tema día' : 'Cambiar a tema noche'}
	title={night ? 'Tema día' : 'Tema noche'}
	class={cn(
		'relative grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-raised',
		className
	)}
>
	{#if night}
		<Sun size={20} stroke-width={1.75} class="text-gold" />
	{:else}
		<Moon size={20} stroke-width={1.75} />
	{/if}
</button>
