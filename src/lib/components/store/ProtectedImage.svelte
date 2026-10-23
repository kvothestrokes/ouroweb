<script lang="ts">
	import { imageSrcset, imageUrl, type ProductImage } from '#lib/domain/store-product.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		image: ProductImage;
		alt: string;
		/** `sizes` attribute for the srcset. */
		sizes: string;
		eager?: boolean;
		class?: string;
	};

	let { image, alt, sizes, eager = false, class: className }: Props = $props();

	// Tracked per source, so a new image (color change) fades in again.
	let loadedSrc = $state<string | null>(null);
	const loaded = $derived(loadedSrc === image.src);

	function markLoaded(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth) loadedSrc = image.src;
	}
</script>

<!--
	Deterrent only (spec 5.3): the image is already a watermarked mockup. The transparent layer
	on top keeps "save image" and dragging away from the real <img>.
-->
<div class={cn('relative overflow-hidden product-stage', className)}>
	{#key image.src}
		<img
			src={imageUrl(image, 800)}
			srcset={imageSrcset(image)}
			{sizes}
			{alt}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : undefined}
			decoding="async"
			draggable="false"
			onload={() => (loadedSrc = image.src)}
			{@attach markLoaded}
			class={cn(
				'pointer-events-none absolute inset-0 size-full object-cover transition-[opacity,scale] duration-500 image-guard',
				loaded ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0'
			)}
		/>
	{/key}
	{#if !loaded}
		<div class="absolute inset-0 animate-pulse bg-surface-raised/40" aria-hidden="true"></div>
	{/if}
	<div
		class="absolute inset-0 image-guard"
		aria-hidden="true"
		oncontextmenu={(event) => event.preventDefault()}
	></div>
</div>
