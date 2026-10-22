<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Eye, EyeOff, Star, Trash2 } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const pending = $derived(data.reviews.filter((review) => !review.aprobada).length);
	const date = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeZone: 'America/Mexico_City'
	});
</script>

<svelte:head>
	<title>Reseñas · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Reseñas</h1>
<p class="mt-2 text-muted-foreground">
	{pending
		? `${pending} por revisar. Solo las publicadas se ven en la tienda.`
		: 'Nada por revisar. Solo las publicadas se ven en la tienda.'}
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

{#if data.reviews.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay reseñas. Los clientes pueden dejarla desde el seguimiento cuando su pedido está
		entregado.
	</p>
{:else}
	<ul class="mt-6 flex flex-col gap-3">
		{#each data.reviews as review (review.id)}
			<li
				class="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row {review.aprobada
					? 'border-border'
					: 'border-warning/50'}"
			>
				{#if review.foto}
					<img
						src={review.foto}
						alt="Foto de la reseña"
						class="size-28 shrink-0 rounded-lg object-cover"
					/>
				{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
					<p class="flex items-center gap-2">
						<span class="flex" aria-label="{review.calificacion} de 5 estrellas">
							{#each [1, 2, 3, 4, 5] as value (value)}
								<Star
									size={14}
									strokeWidth={1.5}
									class={value <= review.calificacion
										? 'fill-gold text-gold'
										: 'text-muted-foreground'}
									aria-hidden="true"
								/>
							{/each}
						</span>
						<span
							class="rounded-full px-2 py-0.5 text-xs {review.aprobada
								? 'bg-success/15 text-success'
								: 'bg-warning/15 text-warning'}"
						>
							{review.aprobada ? 'Publicada' : 'Por revisar'}
						</span>
					</p>
					{#if review.texto}<p class="whitespace-pre-line text-foreground">{review.texto}</p>{/if}
					<p class="text-xs text-muted-foreground">
						{review.orders?.cliente_nombre} · {review.products?.nombre ?? 'Encargo'} · {date.format(
							new Date(review.created_at)
						)}
						{#if review.orders}
							·
							<a
								href={resolve('/admin/(panel)/pedidos/[id]', { id: review.orders.id })}
								class="text-purple-light hover:underline"
							>
								{review.orders.folio}
							</a>
						{/if}
					</p>
				</div>
				<div class="flex items-start gap-2">
					<form method="POST" action="?/aprobar" use:enhance>
						<input type="hidden" name="id" value={review.id} />
						<input type="hidden" name="aprobada" value={String(!review.aprobada)} />
						<Button
							type="submit"
							variant={review.aprobada ? 'outline' : 'default'}
							class="min-h-11"
						>
							{#if review.aprobada}
								<EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> Ocultar
							{:else}
								<Eye size={18} strokeWidth={1.75} aria-hidden="true" /> Publicar
							{/if}
						</Button>
					</form>
					<form method="POST" action="?/eliminar" use:enhance>
						<input type="hidden" name="id" value={review.id} />
						<Button
							type="submit"
							variant="ghost"
							class="min-h-11 text-muted-foreground hover:text-danger"
							aria-label="Eliminar reseña"
							onclick={(event) => {
								if (!confirm('¿Eliminar esta reseña?')) event.preventDefault();
							}}
						>
							<Trash2 size={18} strokeWidth={1.75} />
						</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}
