<script lang="ts">
	import { PUBLIC_WHATSAPP_NUMBER } from '$app/env/public';
	import { navigating } from '$app/state';
	import StoreFooter from '#lib/components/store/StoreFooter.svelte';
	import StoreHeader from '#lib/components/store/StoreHeader.svelte';
	import { whatsappLink } from '#lib/domain/whatsapp.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if navigating.to}
	<div
		class="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-gold"
		role="progressbar"
		aria-label="Cargando"
	></div>
{/if}

<a
	href="#contenido"
	class="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	Saltar al contenido
</a>

<div class="flex min-h-dvh flex-col">
	<StoreHeader categories={data.categories} />
	<main id="contenido" class="flex-1">
		{@render children()}
	</main>
	<StoreFooter categories={data.categories} whatsappHref={whatsappLink(PUBLIC_WHATSAPP_NUMBER)} />
</div>
