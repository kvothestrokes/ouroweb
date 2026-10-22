<script lang="ts">
	import { STATUS_LABELS, type OrderStatus } from '#lib/domain/order-status.js';
	import { cn } from '#lib/utils.js';

	let { estado, class: className }: { estado: OrderStatus; class?: string } = $props();

	const tone: Record<OrderStatus, string> = {
		pendiente: 'bg-warning/15 text-warning',
		esperando_anticipo: 'border border-warning/50 text-warning',
		confirmado: 'bg-accent/25 text-purple-light',
		en_produccion: 'bg-accent/25 text-purple-light',
		listo: 'bg-gold/15 text-gold',
		enviado: 'bg-gold/15 text-gold',
		listo_para_recoger: 'bg-gold/15 text-gold',
		entregado: 'bg-success/15 text-success',
		cancelado: 'bg-surface-raised text-muted-foreground'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
		tone[estado],
		className
	)}
>
	{STATUS_LABELS[estado]}
</span>
