<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Trash2, X } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import ProductForm from '#lib/components/admin/ProductForm.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { downscaleOnPick } from '#lib/client/downscale-image.js';
	import { MAX_PHOTO_WIDTH } from '#lib/domain/design-variant.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let saving = $state(false);
	let uploading = $state(false);

	const success = $derived(form?.success ?? (data.created ? 'Producto creado.' : null));
</script>

<svelte:head>
	<title>{data.product.nombre} · Productos · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/productos')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
	Productos
</a>

<h1 class="mt-2 font-display text-2xl text-foreground md:text-3xl">{data.product.nombre}</h1>

<FormMessage error={form?.message} {success} class="mt-4" />

{#if data.product.tipo_imagen === 'foto'}
	<section
		class="mt-6 max-w-4xl rounded-xl border border-border bg-card p-5"
		aria-labelledby="fotos"
	>
		<h2 id="fotos" class="font-display text-lg text-foreground">Fotos</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			La primera es la principal. En la tienda se sirven reducidas y con marca de agua.
		</p>

		{#if data.images.length === 0}
			<p class="mt-4 text-sm text-warning">Este producto todavía no tiene fotos.</p>
		{:else}
			<ul class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
				{#each data.images as image, index (image.id)}
					<li class="overflow-hidden rounded-lg border border-border bg-surface-raised">
						<img
							src={image.url}
							alt="Foto {index + 1} de {data.product.nombre}"
							width="400"
							height="400"
							loading="lazy"
							draggable="false"
							class="aspect-square w-full object-cover"
						/>
						<div class="flex items-center justify-between">
							<form method="POST" action="?/foto_mover" use:enhance>
								<input type="hidden" name="image_id" value={image.id} />
								<input type="hidden" name="direccion" value="antes" />
								<button
									type="submit"
									disabled={index === 0}
									aria-label="Mover la foto {index + 1} antes"
									class="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
								>
									<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
								</button>
							</form>
							<form
								method="POST"
								action="?/foto_eliminar"
								use:enhance={({ cancel }) => {
									if (!confirm('¿Eliminar esta foto?')) cancel();
								}}
							>
								<input type="hidden" name="image_id" value={image.id} />
								<button
									type="submit"
									aria-label="Eliminar la foto {index + 1}"
									class="flex size-11 items-center justify-center text-muted-foreground hover:text-danger"
								>
									<X size={18} strokeWidth={1.75} aria-hidden="true" />
								</button>
							</form>
							<form method="POST" action="?/foto_mover" use:enhance>
								<input type="hidden" name="image_id" value={image.id} />
								<input type="hidden" name="direccion" value="despues" />
								<button
									type="submit"
									disabled={index === data.images.length - 1}
									aria-label="Mover la foto {index + 1} después"
									class="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
								>
									<ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<form
			method="POST"
			action="?/foto_subir"
			enctype="multipart/form-data"
			class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
			use:enhance={() => {
				uploading = true;
				return async ({ update }) => {
					await update();
					uploading = false;
				};
			}}
		>
			<div class="flex flex-1 flex-col gap-2">
				<Label for="foto">Agregar foto</Label>
				<input
					id="foto"
					name="foto"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					required
					{@attach downscaleOnPick(MAX_PHOTO_WIDTH, { keepPng: false })}
					class="min-h-11 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-foreground"
				/>
			</div>
			<Button type="submit" class="min-h-11" disabled={uploading}>
				{#if uploading}
					<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
					Subiendo…
				{:else}
					<ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
					Subir foto
				{/if}
			</Button>
		</form>
	</section>
{/if}

<form
	method="POST"
	action="?/guardar"
	class="mt-6 flex max-w-4xl flex-col gap-6"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<ProductForm
		context={data.context}
		values={{
			product: data.product,
			colors: data.colors,
			collections: data.collections,
			stock: data.stock
		}}
	/>
	<div>
		<Button type="submit" size="lg" class="min-h-11" disabled={saving}>
			{#if saving}
				<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
				Guardando…
			{:else}
				Guardar cambios
			{/if}
		</Button>
	</div>
</form>

<form
	method="POST"
	action="?/eliminar"
	class="mt-8"
	use:enhance={({ cancel }) => {
		if (!confirm(`¿Eliminar «${data.product.nombre}»? Los pedidos que ya lo tienen no cambian.`))
			cancel();
	}}
>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-danger hover:bg-danger/10"
	>
		<Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
		Eliminar producto
	</button>
</form>
