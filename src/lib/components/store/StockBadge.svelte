<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { enStock, class: className }: { enStock: boolean; class?: string } = $props();
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
		enStock ? 'bg-success/15 text-success' : 'bg-surface-raised text-muted-foreground',
		className
	)}
>
	<span class={cn('size-1.5 rounded-full', enStock ? 'bg-success' : 'bg-muted-foreground')}></span>
	{enStock ? 'En stock' : 'Bajo pedido'}
</span>
