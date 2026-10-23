<script lang="ts">
	type Props = {
		/** Error from a failed action; takes precedence over `success`. */
		error?: string | null;
		success?: string | null;
		class?: string;
	};

	let { error, success, class: className = '' }: Props = $props();
</script>

{#if error}
	<p
		role="alert"
		class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger {className}"
	>
		{error}
	</p>
{:else if success}
	<p
		role="status"
		class="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success {className}"
	>
		{success}
	</p>
{/if}
