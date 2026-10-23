<script lang="ts">
	import Seo from '#lib/components/store/Seo.svelte';
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/store/EmptyState.svelte';
	import ProtectedImage from '#lib/components/store/ProtectedImage.svelte';
	import { productImages } from '#lib/domain/store-product.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const visible = $derived(data.collections.filter((collection) => collection.count > 0));
</script>

<Seo
	title="Colecciones por fandom — Ouroboros"
	description="Encuentra tus diseños por anime, videojuego o película."
/>

<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
	<header>
		<h1 class="text-3xl md:text-4xl">Colecciones</h1>
		<p class="mt-2 text-muted-foreground">Encuentra tus diseños por fandom.</p>
	</header>

	{#if visible.length}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
			{#each visible as collection (collection.id)}
				{@const cover = collection.cover ? productImages(collection.cover)[0] : null}
				<li>
					<a
						href={resolve('/(store)/colecciones/[slug]', { slug: collection.slug })}
						class="group block"
					>
						<div class="relative overflow-hidden rounded-xl">
							{#if cover}
								<ProtectedImage
									image={cover}
									alt=""
									sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
									class="aspect-square transition-transform duration-500 group-hover:scale-[1.03]"
								/>
							{:else}
								<div class="aspect-square product-stage"></div>
							{/if}
							<div
								class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-12"
							>
								<p class="font-display text-lg text-foreground group-hover:text-gold">
									{collection.nombre}
								</p>
								<p class="text-xs text-muted-foreground">
									{collection.count}
									{collection.count === 1 ? 'producto' : 'productos'}
								</p>
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState title="Muy pronto">Estamos armando las colecciones por fandom.</EmptyState>
	{/if}
</div>
