<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ImagePlus, Trash2 } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { downscaleImage } from '#lib/client/downscale-image.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	let fileName = $state<string | null>(null);

	const upload: SubmitFunction = async ({ formData }) => {
		busy = true;
		const photo = formData.get('foto');
		if (photo instanceof File && photo.size > 0) {
			formData.set('foto', await downscaleImage(photo, 2000, { keepPng: false }));
		}
		return async ({ update, result }) => {
			await update();
			busy = false;
			if (result.type === 'success') fileName = null;
		};
	};
	const select = 'min-h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm';
</script>

<svelte:head>
	<title>Galería · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Galería de trabajos</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Fotos de trabajos terminados para la página «Galería». Se muestran con la marca de agua.
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<form
	method="POST"
	action="?/subir"
	enctype="multipart/form-data"
	use:enhance={upload}
	class="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
>
	<label
		class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground hover:border-purple-light hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring sm:col-span-2"
	>
		<ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
		<span class="truncate">{fileName ?? 'Elegir foto (JPG, PNG o WebP)'}</span>
		<input
			type="file"
			name="foto"
			accept="image/jpeg,image/png,image/webp"
			required
			onchange={(event) => (fileName = event.currentTarget.files?.[0]?.name ?? null)}
			class="sr-only"
		/>
	</label>
	<div class="flex flex-col gap-2">
		<Label for="titulo">Título (opcional)</Label>
		<Input id="titulo" name="titulo" maxlength={120} class="min-h-11" />
	</div>
	<div class="flex flex-col gap-2">
		<Label for="collection_id">Colección (opcional)</Label>
		<select id="collection_id" name="collection_id" class={select}>
			<option value="">Ninguna</option>
			{#each data.collections as collection (collection.id)}
				<option value={collection.id}>{collection.nombre}</option>
			{/each}
		</select>
	</div>
	<Button type="submit" class="min-h-11 sm:col-span-2" disabled={busy}>
		{busy ? 'Subiendo…' : 'Agregar a la galería'}
	</Button>
</form>

{#if data.items.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		La galería está vacía. Sube la primera foto de un trabajo terminado.
	</p>
{:else}
	<ul class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each data.items as item (item.id)}
			<li class="overflow-hidden rounded-xl border border-border bg-card">
				<img
					src={item.src}
					alt={item.titulo || 'Trabajo'}
					class="aspect-[4/3] w-full object-cover"
				/>
				<form method="POST" action="?/guardar" use:enhance class="grid gap-3 p-4">
					<input type="hidden" name="id" value={item.id} />
					<Input
						name="titulo"
						value={item.titulo}
						maxlength={120}
						placeholder="Título"
						aria-label="Título"
						class="min-h-11"
					/>
					<div class="grid grid-cols-[1fr_5rem] gap-3">
						<select name="collection_id" aria-label="Colección" class={select}>
							<option value="">Sin colección</option>
							{#each data.collections as collection (collection.id)}
								<option value={collection.id} selected={collection.id === item.collection_id}
									>{collection.nombre}</option
								>
							{/each}
						</select>
						<Input
							name="orden"
							type="number"
							min="0"
							max="999"
							value={item.orden}
							aria-label="Orden"
							class="min-h-11"
						/>
					</div>
					<div class="flex gap-2">
						<Button type="submit" variant="outline" class="min-h-11 flex-1">Guardar</Button>
						<Button
							type="submit"
							formaction="?/eliminar"
							variant="ghost"
							class="min-h-11 text-muted-foreground hover:text-danger"
							aria-label="Eliminar foto"
							onclick={(event) => {
								if (!confirm('¿Eliminar esta foto de la galería?')) event.preventDefault();
							}}
						>
							<Trash2 size={18} strokeWidth={1.75} />
						</Button>
					</div>
				</form>
			</li>
		{/each}
	</ul>
{/if}
