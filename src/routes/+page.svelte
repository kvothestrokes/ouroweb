<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';

	const whatsappHref = `https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`;
</script>

<svelte:head>
	<title>Ouroboros — Próximamente</title>
	<meta
		name="description"
		content="Playeras, sudaderas y productos personalizados con diseños de anime y cultura pop."
	/>
</svelte:head>

<main class="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
	<h1 class="text-4xl text-gold sm:text-5xl">Ouroboros</h1>
	<p class="max-w-md text-muted-foreground">
		Estamos preparando la tienda. Mientras tanto, escríbenos por WhatsApp para pedidos y encargos.
	</p>
	<Button href={whatsappHref} target="_blank" rel="noopener" size="lg" class="min-h-11 px-6">
		Escríbenos por WhatsApp
	</Button>
</main>
