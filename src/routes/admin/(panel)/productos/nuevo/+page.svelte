<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, LoaderCircle } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import ProductForm from '#lib/components/admin/ProductForm.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
</script>

<svelte:head>
	<title>Nuevo producto · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/productos')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Productos
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">Nuevo producto</h1>

<FormMessage error={form?.message} class="mt-4" />

<form
	method="POST"
	class="mt-6 flex max-w-4xl flex-col gap-6"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<ProductForm context={data.context} />
	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{#if saving}
				<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
				Guardando…
			{:else}
				Crear producto
			{/if}
		</Button>
	</div>
</form>
