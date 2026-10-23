<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Trash2 } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
</script>

<svelte:head>
	<title>{data.collection.nombre} · Colecciones · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/colecciones')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Colecciones
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">{data.collection.nombre}</h1>

<FormMessage error={form?.message} success={form?.success} class="mt-4" />

<form
	method="POST"
	action="?/guardar"
	class="mt-6 flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-card p-5"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<div class="flex flex-col gap-2">
		<Label for="nombre">Nombre</Label>
		<Input
			id="nombre"
			name="nombre"
			required
			maxlength={60}
			value={data.collection.nombre}
			class="min-h-11"
		/>
	</div>
	<div class="flex flex-col gap-2">
		<Label for="slug">Slug (URL)</Label>
		<Input id="slug" name="slug" value={data.collection.slug} class="min-h-11" />
		<p class="text-xs text-muted-foreground">
			Si cambias el slug, cambia la dirección de la página de la colección.
		</p>
	</div>
	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{saving ? 'Guardando…' : 'Guardar cambios'}
		</Button>
	</div>
</form>

<form
	method="POST"
	action="?/eliminar"
	class="mt-6"
	use:enhance={({ cancel }) => {
		if (
			!confirm(
				`¿Eliminar la colección «${data.collection.nombre}»? Los productos solo pierden esta etiqueta.`
			)
		)
			cancel();
	}}
>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
	>
		<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
		Eliminar colección
	</button>
</form>
