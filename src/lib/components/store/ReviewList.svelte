<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import type { StoreReview } from '#lib/server/store.js';

	let { reviews }: { reviews: StoreReview[] } = $props();

	const date = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
	const average = $derived(
		reviews.length
			? reviews.reduce((sum, review) => sum + review.calificacion, 0) / reviews.length
			: 0
	);
</script>

{#if reviews.length}
	<div class="flex flex-col gap-6">
		<p class="flex items-center gap-2 text-sm text-muted-foreground">
			<Star size={18} stroke-width={1.5} class="fill-gold text-gold" aria-hidden="true" />
			<span class="font-semibold text-foreground">{average.toFixed(1)}</span>
			de 5 · {reviews.length}
			{reviews.length === 1 ? 'reseña' : 'reseñas'}
		</p>
		<ul class="grid gap-4 sm:grid-cols-2">
			{#each reviews as review (review.id)}
				<li class="flex gap-4 rounded-xl border border-border bg-surface p-4">
					{#if review.foto}
						<img
							src={review.foto}
							alt="Foto de un cliente"
							loading="lazy"
							draggable="false"
							class="size-24 shrink-0 rounded-lg object-cover image-guard"
						/>
					{/if}
					<div class="flex min-w-0 flex-col gap-1">
						<p class="flex gap-0.5" aria-label="{review.calificacion} de 5 estrellas">
							{#each [1, 2, 3, 4, 5] as value (value)}
								<Star
									size={14}
									stroke-width={1.5}
									class={value <= review.calificacion
										? 'fill-gold text-gold'
										: 'text-muted-foreground'}
									aria-hidden="true"
								/>
							{/each}
						</p>
						{#if review.texto}<p class="text-sm whitespace-pre-line">{review.texto}</p>{/if}
						<p class="text-xs text-muted-foreground">{date.format(new Date(review.creado))}</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
