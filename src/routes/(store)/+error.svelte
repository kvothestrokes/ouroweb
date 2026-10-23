<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'No encontrado' : 'Algo salió mal'} — Ouroboros</title>
</svelte:head>

<section class="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
	<p class="font-display text-6xl text-gold">{page.status}</p>
	<h1 class="text-2xl">
		{page.status === 404 ? 'No encontramos esta página' : 'Algo salió mal'}
	</h1>
	<p class="text-muted-foreground">
		{page.status === 404
			? 'Puede que el producto ya no esté disponible o que el enlace haya cambiado.'
			: page.status === 503
				? (page.error?.message ?? 'Intenta de nuevo en unos minutos.')
				: 'Intenta de nuevo en unos minutos.'}
	</p>
	<div class="mt-2 flex flex-wrap justify-center gap-3">
		<a
			href={resolve('/(store)')}
			class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
		>
			Ir al inicio
		</a>
		{#if page.status !== 404}
			<button
				type="button"
				onclick={() => location.reload()}
				class="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm hover:bg-surface-raised"
			>
				Reintentar
			</button>
		{/if}
	</div>
</section>
