<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const fields = [
		{ name: 'base', label: 'Prenda base (JPG/PNG, ej. 2000×2000)', pathName: 'basePath' },
		{ name: 'design', label: 'Diseño PNG transparente (privado)', pathName: 'designPath' },
		{ name: 'watermark', label: 'Marca de agua PNG semitransparente', pathName: 'watermarkPath' }
	] as const;
</script>

<svelte:head>
	<title>Spike ImageKit — Ouroboros</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl text-gold">Spike ImageKit</h1>
		<p class="text-muted-foreground">
			Página temporal de desarrollo. Sube los archivos (o reutiliza rutas ya subidas) y revisa que
			el mockup firmado se componga y que el diseño no sea accesible sin firma.
		</p>
	</header>

	<form method="POST" enctype="multipart/form-data" class="flex flex-col gap-6">
		{#each fields as field (field.name)}
			<fieldset class="flex flex-col gap-2 rounded-lg border border-border p-4">
				<legend class="px-1 font-medium">{field.label}</legend>
				<input
					type="file"
					name={field.name}
					accept="image/*"
					class="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-secondary-foreground"
				/>
				<label class="flex flex-col gap-1 text-sm text-muted-foreground">
					o ruta existente
					<input
						type="text"
						name={field.pathName}
						value={form?.paths?.[field.pathName] ?? ''}
						placeholder="/ouroboros/…"
						class="min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
					/>
				</label>
			</fieldset>
		{/each}

		<fieldset class="grid grid-cols-3 gap-3 rounded-lg border border-border p-4">
			<legend class="px-1 font-medium">Área de impresión (px del lienzo base)</legend>
			{#each ['x', 'y', 'width'] as const as key (key)}
				<label class="flex flex-col gap-1 text-sm text-muted-foreground">
					{key === 'width' ? 'ancho' : key}
					<input
						type="number"
						name={key}
						min="0"
						value={form?.printArea?.[key] ?? (key === 'width' ? 600 : key === 'x' ? 700 : 500)}
						class="min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
					/>
				</label>
			{/each}
		</fieldset>

		<Button type="submit" size="lg" class="min-h-11 self-start px-6">Subir y componer</Button>
	</form>

	{#if form?.message}
		<p role="alert" class="rounded-md border border-destructive p-4 text-destructive">
			{form.message}
		</p>
	{/if}

	{#if form?.mockups}
		<section class="flex flex-col gap-4">
			<h2 class="text-xl">Resultado</h2>
			<img
				src={form.mockups[1]}
				alt="Mockup compuesto del diseño sobre la prenda base"
				width="800"
			/>
			<pre class="overflow-x-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(
					{ paths: form.paths, probes: form.probes, mockups: form.mockups },
					null,
					2
				)}</pre>
		</section>
	{/if}
</main>
