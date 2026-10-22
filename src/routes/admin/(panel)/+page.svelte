<script lang="ts">
	import { resolve } from '$app/paths';
	import { NAV } from './nav.js';

	const sections = NAV.filter((item) => item.path !== '/admin');
</script>

<svelte:head>
	<title>Inicio · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">¡Hola de nuevo!</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Desde aquí vas a administrar el catálogo de la tienda. El resumen de pedidos y ventas llega más
	adelante.
</p>

<ul class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each sections as item (item.path)}
		<li>
			{#if item.route}
				<a
					href={resolve(item.route)}
					class="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-surface-raised"
				>
					<item.icon size={20} strokeWidth={1.75} class="text-gold" />
					<span class="font-medium text-foreground">{item.label}</span>
				</a>
			{:else}
				<div
					class="flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 p-5"
				>
					<item.icon size={20} strokeWidth={1.75} class="text-muted-foreground" />
					<div>
						<p class="font-medium text-muted-foreground">{item.label}</p>
						<p class="text-xs text-muted-foreground">Próximamente</p>
					</div>
				</div>
			{/if}
		</li>
	{/each}
</ul>
