<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	/** Link that leaves the store (WhatsApp); opens in a new tab. */
	let { href, children, ...rest }: HTMLAnchorAttributes & { href: string; children: Snippet } =
		$props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external URL, not a route -->
<a {href} target="_blank" rel="noopener" {...rest}>{@render children()}</a>
