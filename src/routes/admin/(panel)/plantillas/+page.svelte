<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { renderTemplate } from '#lib/domain/whatsapp.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	let selected = $state<string | null>(null);
	const current = $derived(
		data.templates.find((template) => template.clave === selected) ?? data.templates[0]
	);
	let draft = $derived(current?.cuerpo ?? '');

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	};

	const SAMPLE: Record<string, string> = {
		folio: 'OUR-2610-0042',
		nombre: 'Ana',
		resumen: '• 2× Playera Akatsuki · Negro · M — $340.00',
		metodo_entrega: 'Paquetería nacional',
		subtotal: '$340.00',
		descuentos: '$0.00',
		personalizacion: 'por cotizar',
		envio: '$150.00',
		total: '$490.00',
		anticipo: '$245.00',
		pagado: '$245.00',
		saldo: '$245.00',
		guia: '1234567890',
		link_seguimiento: 'https://ouroboros.mx/seguimiento?folio=OUR-2610-0042'
	};
	const VARIABLES = [...Object.keys(SAMPLE), 'datos_bancarios', 'direccion_taller'];

	const preview = $derived(
		renderTemplate(draft, {
			...SAMPLE,
			datos_bancarios: data.settings.datos_bancarios || '(datos bancarios)',
			direccion_taller: data.settings.direccion_taller || '(dirección del taller)'
		})
	);

	let textarea = $state<HTMLTextAreaElement>();
	function insert(variable: string) {
		if (!textarea) return;
		const token = `{{${variable}}}`;
		const start = textarea.selectionStart;
		draft = draft.slice(0, start) + token + draft.slice(textarea.selectionEnd);
		requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(start + token.length, start + token.length);
		});
	}
</script>

<svelte:head>
	<title>Plantillas · Panel Ouroboros</title>
</svelte:head>

<h1 class="font-display text-2xl text-foreground md:text-3xl">Plantillas de WhatsApp</h1>
<p class="mt-2 max-w-prose text-muted-foreground">
	Los mensajes que se arman al avisar a un cliente desde un pedido. Usa las variables entre llaves;
	las que no tengan valor quedan vacías.
</p>

<FormMessage error={form?.message} success={form?.success} class="mt-6" />

<div class="mt-6 grid gap-6 lg:grid-cols-[14rem_1fr]">
	<nav aria-label="Plantillas">
		<ul class="flex gap-2 overflow-x-auto lg:flex-col">
			{#each data.templates as template (template.clave)}
				<li class="shrink-0">
					<button
						type="button"
						onclick={() => (selected = template.clave)}
						aria-current={current?.clave === template.clave ? 'true' : undefined}
						class="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm transition-colors {current?.clave ===
						template.clave
							? 'bg-accent text-accent-foreground'
							: 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'}"
					>
						{template.nombre}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	{#if current}
		<form method="POST" action="?/plantilla" use:enhance={submit} class="grid gap-4 xl:grid-cols-2">
			<input type="hidden" name="clave" value={current.clave} />
			<div class="flex flex-col gap-2">
				<Label for="cuerpo">{current.nombre}</Label>
				<textarea
					id="cuerpo"
					name="cuerpo"
					bind:this={textarea}
					bind:value={draft}
					rows="14"
					maxlength="2000"
					class="rounded-md border border-border bg-transparent p-3 font-mono text-sm"></textarea>
				<div class="flex flex-wrap gap-1.5" aria-label="Insertar variable">
					{#each VARIABLES as variable (variable)}
						<button
							type="button"
							onclick={() => insert(variable)}
							class="min-h-9 rounded-full border border-border px-2.5 text-xs text-muted-foreground hover:border-purple-light hover:text-foreground"
						>
							{variable}
						</button>
					{/each}
				</div>
				<Button type="submit" class="mt-2 min-h-11" disabled={busy}>Guardar plantilla</Button>
			</div>
			<div class="flex flex-col gap-2">
				<p class="text-sm text-muted-foreground">Vista previa con datos de ejemplo</p>
				<div class="rounded-xl bg-success/10 p-4 text-sm whitespace-pre-line text-foreground">
					{preview}
				</div>
			</div>
		</form>
	{/if}
</div>

<section class="mt-12 max-w-3xl">
	<h2 class="font-display text-xl text-foreground">Datos del negocio</h2>
	<p class="mt-1 text-sm text-muted-foreground">
		Se usan en las plantillas (<code>datos_bancarios</code>, <code>direccion_taller</code>) y en el
		anticipo sugerido de cada pedido.
	</p>
	<form method="POST" action="?/negocio" use:enhance={submit} class="mt-4 grid gap-4">
		<div class="flex flex-col gap-2">
			<Label for="datos_bancarios">Datos bancarios para el anticipo</Label>
			<textarea
				id="datos_bancarios"
				name="datos_bancarios"
				rows="4"
				maxlength="500"
				placeholder="Banco, titular, CLABE…"
				class="rounded-md border border-border bg-transparent p-3 text-sm"
				>{data.settings.datos_bancarios}</textarea
			>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-2">
				<Label for="direccion_taller">Dirección del taller</Label>
				<Input
					id="direccion_taller"
					name="direccion_taller"
					value={data.settings.direccion_taller}
					maxlength={300}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="horarios">Horarios</Label>
				<Input
					id="horarios"
					name="horarios"
					value={data.settings.horarios}
					maxlength={200}
					placeholder="Lun a sáb, 10:00 a 19:00"
					class="min-h-11"
				/>
			</div>
		</div>
		<div class="flex max-w-48 flex-col gap-2">
			<Label for="anticipo_sugerido_pct">Anticipo sugerido (%)</Label>
			<Input
				id="anticipo_sugerido_pct"
				name="anticipo_sugerido_pct"
				type="number"
				min="0"
				max="100"
				value={data.settings.anticipo_sugerido_pct}
				class="min-h-11"
			/>
		</div>
		<Button type="submit" variant="outline" class="min-h-11 w-fit" disabled={busy}
			>Guardar datos</Button
		>
	</form>
</section>
