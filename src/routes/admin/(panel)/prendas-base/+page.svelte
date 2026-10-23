<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ImagePlus, LoaderCircle } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let registering = $state<string | null>(null);

	function photoUrl(foto: string): string {
		const [tipo, color] = foto.split('/');
		return `${resolve('/admin/(panel)/prendas-base/foto/[tipo]/[color]', { tipo, color })}?w=400`;
	}
</script>

<svelte:head>
	<title>Prendas base · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Prendas base</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Cada color de prenda lisa sobre el que se arman los mockups. Entra a uno para ajustar su área de
	impresión.
</p>

<FormMessage
	error={form?.message}
	success={form?.registered
		? `Listo: registramos ${form.registered} ${form.registered === 1 ? 'color nuevo' : 'colores nuevos'}.`
		: null}
	class="mt-6"
/>

{#each data.types as type (type.id)}
	<section class="mt-10" aria-labelledby="tipo-{type.id}">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 id="tipo-{type.id}" class="font-display text-xl text-foreground">
				{type.nombre}
				<span class="font-sans text-sm text-muted-foreground">· {type.bases.length} colores</span>
			</h2>

			{#if type.pendingPhotos.length > 0}
				<form
					method="POST"
					action="?/registrar"
					use:enhance={() => {
						registering = type.id;
						return async ({ update }) => {
							await update();
							registering = null;
						};
					}}
				>
					<input type="hidden" name="garment_type_id" value={type.id} />
					<Button type="submit" class="min-h-11" disabled={registering !== null}>
						{#if registering === type.id}
							<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
							Registrando…
						{:else}
							<ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
							Registrar {type.pendingPhotos.length}
							{type.pendingPhotos.length === 1 ? 'foto nueva' : 'fotos nuevas'}
						{/if}
					</Button>
				</form>
			{/if}
		</div>

		{#if type.bases.length === 0}
			<div
				class="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
			>
				{#if type.pendingPhotos.length > 0}
					Hay {type.pendingPhotos.length} fotos de {type.nombre.toLowerCase()} listas para registrar.
				{:else}
					Aún no hay fotos de {type.nombre.toLowerCase()}. Agrégalas en
					<code class="text-foreground">src/lib/server/assets/bases/{type.tipo}/</code>, una por
					color.
				{/if}
			</div>
		{:else}
			<ul class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{#each type.bases as base (base.id)}
					<li>
						<a
							href={resolve('/admin/(panel)/prendas-base/[id]', { id: base.id })}
							class="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-surface-raised"
						>
							<div class="aspect-square bg-surface-raised">
								<img
									src={photoUrl(base.foto)}
									alt="{type.nombre} {base.color_nombre.toLowerCase()}"
									width="400"
									height="400"
									loading="lazy"
									class="size-full object-cover"
								/>
							</div>
							<div class="flex items-center gap-2 p-3">
								<span
									class="size-4 shrink-0 rounded-full border border-border"
									style:background-color={base.color_hex}
									aria-hidden="true"
								></span>
								<span class="truncate text-sm font-medium text-foreground">{base.color_nombre}</span
								>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{base.es_clara ? 'Clara' : 'Oscura'}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/each}
