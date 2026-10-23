<script lang="ts">
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	type Props = {
		open: boolean;
		title: string;
		description?: string;
		/** `left`/`right` slide in from that side; `center` is a modal. */
		side?: 'left' | 'right' | 'center';
		children: Snippet;
		footer?: Snippet;
	};

	let {
		open = $bindable(),
		title,
		description,
		side = 'center',
		children,
		footer
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class={cn(
				'fixed z-50 flex flex-col border-border bg-card text-card-foreground shadow-2xl outline-none',
				'data-[state=closed]:animate-out data-[state=open]:animate-in',
				side === 'center' &&
					'top-1/2 left-1/2 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				side === 'left' &&
					'inset-y-0 left-0 w-[85vw] max-w-sm border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
				side === 'right' &&
					'inset-y-0 right-0 w-[85vw] max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
			)}
		>
			<div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div>
					<Dialog.Title class="font-display text-lg text-foreground">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="mt-1 text-sm text-muted-foreground">
							{description}
						</Dialog.Description>
					{/if}
				</div>
				<Dialog.Close
					class="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
					aria-label="Cerrar"
				>
					<X size={20} stroke-width={1.75} />
				</Dialog.Close>
			</div>
			<div class="flex-1 overflow-y-auto px-5 py-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="border-t border-border px-5 py-4">{@render footer()}</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
