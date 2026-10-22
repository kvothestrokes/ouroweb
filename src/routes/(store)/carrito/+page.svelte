<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
</script>

<svelte:head>
	<title>Tu carrito — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!-- TODO(Fase 4): cart lines, totals and checkout. -->
<div class="mx-auto max-w-3xl px-4 py-10 md:px-6">
	<h1 class="mb-8 text-3xl md:text-4xl">Tu carrito</h1>
	<EmptyState title="Muy pronto">
		Estamos terminando el carrito. Tus productos ya quedaron guardados en este navegador.
		{#snippet action()}
			<a
				href={resolve('/(store)')}
				class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-gold-light"
			>
				Seguir comprando
			</a>
		{/snippet}
	</EmptyState>
</div>
