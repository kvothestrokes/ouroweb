<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	type Values = {
		nombre: string;
		slug: string;
		parent_id: string | null;
		orden: number;
		activo: boolean;
		es_estrella: boolean;
	};

	type Props = {
		/** Main categories a subcategory can hang from. */
		roots: { id: string; nombre: string }[];
		values?: Partial<Values>;
		/** Prefix for element ids, so two forms can share a page. */
		idPrefix?: string;
	};

	let { roots, values = {}, idPrefix = 'cat' }: Props = $props();
	const field = (name: string) => `${idPrefix}-${name}`;
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<div class="flex flex-col gap-2">
		<Label for={field('nombre')}>Nombre</Label>
		<Input
			id={field('nombre')}
			name="nombre"
			required
			maxlength={60}
			value={values.nombre ?? ''}
			class="min-h-11"
		/>
	</div>

	<div class="flex flex-col gap-2">
		<Label for={field('slug')}>Slug (URL)</Label>
		<Input
			id={field('slug')}
			name="slug"
			placeholder="Se genera desde el nombre"
			value={values.slug ?? ''}
			class="min-h-11"
		/>
	</div>

	<div class="flex flex-col gap-2">
		<Label for={field('parent')}>Categoría padre</Label>
		<select
			id={field('parent')}
			name="parent_id"
			class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
		>
			<option value="" selected={!values.parent_id}>Ninguna (categoría principal)</option>
			{#each roots as root (root.id)}
				<option value={root.id} selected={values.parent_id === root.id}>{root.nombre}</option>
			{/each}
		</select>
	</div>

	<div class="flex flex-col gap-2">
		<Label for={field('orden')}>Orden</Label>
		<Input
			id={field('orden')}
			name="orden"
			type="number"
			min={0}
			max={999}
			value={values.orden ?? 0}
			class="min-h-11 tabular-nums"
		/>
	</div>
</div>

<div class="flex flex-col gap-1 sm:flex-row sm:gap-6">
	<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
		<input
			type="checkbox"
			name="activo"
			checked={values.activo ?? false}
			class="size-5 accent-[var(--gold)]"
		/>
		Visible en la tienda
	</label>
	<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
		<input
			type="checkbox"
			name="es_estrella"
			checked={values.es_estrella ?? false}
			class="size-5 accent-[var(--gold)]"
		/>
		Estrella de su categoría (solo subcategorías)
	</label>
</div>
