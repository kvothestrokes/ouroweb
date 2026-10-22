<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LogOut } from '@lucide/svelte';
	import { NAV, isActive } from './nav.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet navLinks(orientation: 'row' | 'column')}
	<ul
		class={orientation === 'column'
			? 'flex flex-col gap-1'
			: 'flex [scrollbar-width:none] gap-1 overflow-x-auto'}
	>
		{#each NAV as item (item.path)}
			{@const active = isActive(item.path, page.url.pathname)}
			<li class="shrink-0">
				{#if item.route}
					<a
						href={resolve(item.route)}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
							active
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
						]}
					>
						<item.icon size={18} strokeWidth={1.75} />
						{item.label}
					</a>
				{:else}
					<span
						aria-disabled="true"
						title="Próximamente"
						class="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/50"
					>
						<item.icon size={18} strokeWidth={1.75} />
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="min-h-dvh bg-background md:grid md:grid-cols-[15rem_1fr]">
	<aside class="hidden border-r border-border bg-surface md:flex md:flex-col">
		<a href={resolve('/admin/(panel)')} class="flex items-center gap-3 px-5 py-6">
			<img src="/brand/ourologo.webp" alt="" width="36" height="36" class="size-9 rounded-full" />
			<span class="font-display text-lg text-gold">Ouroboros</span>
		</a>
		<nav aria-label="Panel" class="flex-1 px-3">
			{@render navLinks('column')}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-col">
		<header class="border-b border-border bg-surface">
			<div class="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
				<a href={resolve('/admin/(panel)')} class="flex items-center gap-2 md:hidden">
					<img
						src="/brand/ourologo.webp"
						alt=""
						width="32"
						height="32"
						class="size-8 rounded-full"
					/>
					<span class="font-display text-gold">Ouroboros</span>
				</a>
				<p class="hidden truncate text-sm text-muted-foreground md:block">{data.adminEmail}</p>
				<form method="POST" action="/admin/logout">
					<button
						type="submit"
						class="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
					>
						<LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
						Cerrar sesión
					</button>
				</form>
			</div>
			<nav aria-label="Panel" class="px-2 pb-2 md:hidden">
				{@render navLinks('row')}
			</nav>
		</header>

		<main class="flex-1 px-4 py-6 md:px-8 md:py-8">
			{@render children()}
		</main>
	</div>
</div>
