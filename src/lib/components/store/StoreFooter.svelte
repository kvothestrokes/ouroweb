<script lang="ts">
	import ExternalLink from '#lib/components/store/ExternalLink.svelte';
	import { resolve } from '$app/paths';
	import type { StoreCategoryTree } from '#lib/domain/store-product.js';

	type Props = { categories: StoreCategoryTree; whatsappHref: string };

	let { categories, whatsappHref }: Props = $props();

	const year = new Date().getFullYear();
</script>

<footer class="dark mt-24 border-t border-border bg-background text-foreground">
	<div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr] md:px-6">
		<div class="flex flex-col gap-3">
			<p class="font-display text-2xl text-gold">Ouroboros</p>
			<p class="max-w-sm text-sm text-muted-foreground">
				Playeras, sudaderas y regalos con diseños de anime y cultura pop, hechos a mano en Chiapas.
				<!-- TODO(copy): confirmar ubicación y descripción con el negocio -->
			</p>
		</div>
		<nav aria-label="Categorías">
			<p class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Tienda</p>
			<ul class="flex flex-col gap-1 text-sm">
				{#each categories as root (root.id)}
					<li>
						<a
							href={resolve('/(store)/c/[categoria]', { categoria: root.slug })}
							class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
						>
							{root.nombre}
						</a>
					</li>
				{/each}
				<li>
					<a
						href={resolve('/(store)/galeria')}
						class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
					>
						Galería
					</a>
				</li>
				<li>
					<a
						href={resolve('/(store)/colecciones')}
						class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
					>
						Colecciones
					</a>
				</li>
			</ul>
		</nav>
		<div>
			<p class="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
				Contacto
			</p>
			<ul class="flex flex-col gap-1 text-sm">
				<li>
					<ExternalLink
						href={whatsappHref}
						class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
					>
						WhatsApp
					</ExternalLink>
				</li>
				<li>
					<a
						href={resolve('/(store)/seguimiento')}
						class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
					>
						Sigue tu pedido
					</a>
				</li>
				<li>
					<a
						href={resolve('/(store)/favoritos')}
						class="inline-flex min-h-11 items-center text-foreground/90 hover:text-gold"
					>
						Mis favoritos
					</a>
				</li>
			</ul>
		</div>
	</div>
	<p class="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
		© {year} Ouroboros. Diseños con fines de fan art; los pedidos se confirman por WhatsApp.
	</p>
</footer>
