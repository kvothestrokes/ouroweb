<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { ProductImage } from '#lib/domain/store-product.js';
	import ProtectedImage from './ProtectedImage.svelte';

	type Props = {
		eyebrow: string;
		title: string;
		text: string;
		href: string;
		cta: string;
		image: ProductImage | null;
	};

	let { eyebrow, title, text, href, cta, image }: Props = $props();
</script>

<section
	class="relative isolate overflow-hidden rounded-2xl border border-border bg-surface md:grid md:min-h-80 md:grid-cols-2"
>
	<div
		class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,var(--color-purple)/25%,transparent_60%)]"
		aria-hidden="true"
	></div>
	<div class="flex flex-col justify-center gap-3 p-6 md:p-10">
		<p class="text-xs font-medium tracking-[0.2em] text-purple-light uppercase">{eyebrow}</p>
		<h2 class="text-3xl text-foreground md:text-4xl">{title}</h2>
		<p class="max-w-md text-muted-foreground">{text}</p>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass a resolve()d path -->
		<a
			{href}
			class="mt-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-light"
		>
			{cta}
			<ArrowRight size={16} stroke-width={1.75} />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
	{#if image}
		<ProtectedImage
			{image}
			eager
			alt=""
			sizes="(min-width: 768px) 50vw, 100vw"
			class="aspect-[4/3] md:aspect-auto md:h-full"
		/>
	{/if}
</section>
