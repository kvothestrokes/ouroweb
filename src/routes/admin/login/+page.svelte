<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Iniciar sesión · Panel Ouroboros</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
	<div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 sm:p-8">
		<div class="mb-8 flex flex-col items-center gap-3 text-center">
			<img src="/brand/ourologo.webp" alt="" width="64" height="64" class="size-16 rounded-full" />
			<h1 class="font-display text-2xl text-gold">Panel Ouroboros</h1>
			<p class="text-sm text-muted-foreground">Entra con tu cuenta de administrador.</p>
		</div>

		<form
			method="POST"
			class="flex flex-col gap-5"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			{#if form?.message}
				<p
					role="alert"
					class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
				>
					{form.message}
				</p>
			{/if}

			<div class="flex flex-col gap-2">
				<Label for="email">Correo</Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
					class="min-h-11"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="password">Contraseña</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="min-h-11"
				/>
			</div>

			<Button type="submit" size="lg" class="min-h-11" disabled={submitting}>
				{#if submitting}
					<LoaderCircle class="animate-spin" size={18} strokeWidth={1.75} aria-hidden="true" />
					Entrando…
				{:else}
					Entrar
				{/if}
			</Button>
		</form>
	</div>
</main>
