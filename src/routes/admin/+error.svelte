<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Algo salió mal · Panel Ouroboros</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main
	class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center"
>
	<p class="text-sm font-medium text-muted-foreground tabular-nums">Error {page.status}</p>
	<h1 class="font-display text-2xl text-foreground">Algo salió mal</h1>
	<p class="max-w-md text-muted-foreground">
		{page.error?.message ?? 'Intenta de nuevo en un momento.'}
	</p>
	<Button href={resolve('/admin/login')} class="mt-4 min-h-11">Ir a iniciar sesión</Button>
</main>
