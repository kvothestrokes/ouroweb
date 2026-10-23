<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title: string; children?: Snippet; action?: Snippet };

	let { title, children, action }: Props = $props();
</script>

<div
	class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center"
>
	<p class="font-display text-lg text-foreground">{title}</p>
	{#if children}
		<div class="max-w-sm text-sm text-muted-foreground">{@render children()}</div>
	{/if}
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
