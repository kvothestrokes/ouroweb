<script lang="ts">
	let { nombre }: { nombre: string } = $props();
</script>

<span
	class="inline-flex max-w-full items-center truncate rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-purple-light"
>
	{nombre}
</span>
