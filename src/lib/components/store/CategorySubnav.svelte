<script lang="ts">
	import { resolve } from '$app/paths';
	import { cn } from '#lib/utils.js';

	type Item = { slug: string; nombre: string };
	type Props = { parent: Item; items: Item[]; active: string };

	let { parent, items, active }: Props = $props();

	function reveal(isActive: boolean) {
		return (node: HTMLElement) => {
			if (isActive) node.scrollIntoView({ inline: 'center', block: 'nearest' });
		};
	}

	const chips = $derived([{ slug: parent.slug, nombre: 'Todo' }, ...items]);
</script>

<nav aria-label="Subcategorías de {parent.nombre}" class="border-b border-border bg-background/95">
	<ul
		class="mx-auto flex max-w-7xl [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-3 md:px-6 [&::-webkit-scrollbar]:hidden"
	>
		{#each chips as chip (chip.slug)}
			{@const isActive = chip.slug === active}
			<li class="shrink-0">
				<a
					href={resolve('/(store)/c/[categoria]', { categoria: chip.slug })}
					aria-current={isActive ? 'page' : undefined}
					{@attach reveal(isActive)}
					class={cn(
						'inline-flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors',
						isActive
							? 'border-transparent bg-accent text-accent-foreground'
							: 'border-border text-muted-foreground hover:border-purple-light/50 hover:text-foreground'
					)}
				>
					{chip.nombre}
				</a>
			</li>
		{/each}
	</ul>
</nav>
