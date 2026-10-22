<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { RotateCw } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'No encontrado' : 'Algo salió mal'} · Panel Ouroboros</title>
</svelte:head>

<div class="mx-auto max-w-lg py-12 text-center">
	<p class="text-sm font-medium text-muted-foreground tabular-nums">Error {page.status}</p>
	<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">
		{notFound ? 'No encontramos lo que buscas' : 'Algo salió mal'}
	</h1>
	<p class="mt-3 text-muted-foreground">
		{page.error?.message ?? 'Intenta de nuevo en un momento.'}
	</p>
	<div class="mt-8 flex flex-wrap justify-center gap-3">
		{#if !notFound}
			<Button onclick={() => refreshAll()} class="min-h-11">
				<RotateCw size={18} strokeWidth={1.75} aria-hidden="true" />
				Reintentar
			</Button>
		{/if}
		<Button href={resolve('/admin/(panel)')} variant="outline" class="min-h-11">
			Volver al panel
		</Button>
	</div>
</div>
