<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import { favorites } from '#lib/stores/favorites.svelte.js';
	import { cn } from '#lib/utils.js';

	type Props = { slug: string; nombre: string; class?: string; variant?: 'floating' | 'outline' };

	let { slug, nombre, class: className, variant = 'floating' }: Props = $props();

	$effect(() => favorites.load());

	const active = $derived(favorites.has(slug));
</script>

<button
	type="button"
	aria-pressed={active}
	aria-label={active ? `Quitar ${nombre} de favoritos` : `Agregar ${nombre} a favoritos`}
	onclick={(event) => {
		event.preventDefault();
		event.stopPropagation();
		favorites.toggle(slug);
	}}
	class={cn(
		'grid size-11 place-items-center rounded-full transition-colors',
		variant === 'floating'
			? 'bg-background/60 backdrop-blur-sm hover:bg-background/90'
			: 'border border-border hover:bg-surface-raised',
		className
	)}
>
	<Heart
		size={20}
		stroke-width={1.75}
		class={cn('transition-transform', active ? 'scale-110 fill-gold text-gold' : 'text-foreground')}
	/>
</button>
