<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { centsToInput } from '#lib/domain/money.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);

	const submitting = () => {
		busy = true;
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<svelte:head>
	<title>Tipos de encargo · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Tipos de encargo</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Lo que el cliente puede pedir como encargo especial. El precio «desde» se muestra en el
	formulario; el precio final lo cotizas en cada pedido. Déjalo vacío para mostrar «por cotizar».
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<form
	method="POST"
	action="?/crear"
	class="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update();
			busy = false;
		};
	}}
>
	<input type="hidden" name="activo" value="on" />
	<div class="flex flex-col gap-2">
		<Label for="nuevo-nombre">Nombre</Label>
		<Input
			id="nuevo-nombre"
			name="nombre"
			required
			maxlength={60}
			placeholder="Ej. Termo grabado con láser"
			class="min-h-11"
		/>
	</div>
	<div class="flex flex-col gap-2">
		<Label for="nuevo-precio">Desde (MXN)</Label>
		<Input
			id="nuevo-precio"
			name="precio_desde"
			inputmode="decimal"
			placeholder="250"
			class="min-h-11"
		/>
	</div>
	<Button type="submit" class="min-h-11" disabled={busy}>Agregar</Button>
</form>

{#if data.types.length === 0}
	<p
		class="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground"
	>
		Todavía no hay tipos de encargo. Agrega el primero, por ejemplo «Taza sublimada con tu foto».
		<!-- TODO(negocio): tipos de encargo y su «desde $X» (spec, sección 13). -->
	</p>
{:else}
	<ul class="mt-6 flex flex-col gap-3">
		{#each data.types as type (type.id)}
			<li class="rounded-xl border border-border bg-card p-4">
				<form
					method="POST"
					action="?/guardar"
					use:enhance={submitting}
					class="grid gap-3 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end"
				>
					<input type="hidden" name="id" value={type.id} />
					<div class="flex flex-col gap-2">
						<Label for="nombre-{type.id}">Nombre</Label>
						<Input
							id="nombre-{type.id}"
							name="nombre"
							value={type.nombre}
							required
							maxlength={60}
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="precio-{type.id}">Desde (MXN)</Label>
						<Input
							id="precio-{type.id}"
							name="precio_desde"
							value={centsToInput(type.precio_desde)}
							inputmode="decimal"
							placeholder="Por cotizar"
							class="min-h-11"
						/>
					</div>
					<label class="flex min-h-11 items-center gap-2 text-sm">
						<input type="checkbox" name="activo" checked={type.activo} class="size-5 accent-gold" />
						Visible
					</label>
					<div class="flex items-center gap-2">
						<Button type="submit" variant="outline" class="min-h-11" disabled={busy}>Guardar</Button
						>
						<Button
							type="submit"
							formaction="?/eliminar"
							variant="ghost"
							class="min-h-11 text-muted-foreground hover:text-danger"
							aria-label="Eliminar {type.nombre}"
							title="Eliminar"
							disabled={busy}
							onclick={(event) => {
								if (!confirm(`¿Eliminar «${type.nombre}»? Los encargos ya hechos se conservan.`)) {
									event.preventDefault();
								}
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
