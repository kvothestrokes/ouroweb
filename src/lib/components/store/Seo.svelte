<script lang="ts">
	import { page } from '$app/state';

	type Props = {
		title: string;
		description: string;
		/** Path or absolute URL of the share image (F13); the logo when missing. */
		image?: string | null;
		type?: 'website' | 'product';
		/** Search pages and private screens should not be indexed. */
		noindex?: boolean;
	};

	let { title, description, image, type = 'website', noindex = false }: Props = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${page.url.pathname}`);
	const imageUrl = $derived(new URL(image ?? '/brand/ourologo.webp', origin).href);
	const text = $derived(description.replace(/\s+/g, ' ').trim().slice(0, 160));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={text} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={canonical} />
	{/if}
	<meta property="og:site_name" content="Ouroboros" />
	<meta property="og:locale" content="es_MX" />
	<meta property="og:type" content={type === 'product' ? 'product' : 'website'} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={text} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={text} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>
