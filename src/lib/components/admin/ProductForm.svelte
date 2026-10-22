<script lang="ts">
	import { resolve } from '$app/paths';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { centsToInput, formatMoney } from '#lib/domain/money.js';
	import type { ProductRecord } from '#lib/domain/product.js';

	type Option = { id: string; nombre: string };

	type Props = {
		context: {
			garmentTypes: {
				id: string;
				nombre: string;
				tallas: string[];
				precio_normal: number | null;
			}[];
			bases: {
				id: string;
				garment_type_id: string;
				color_nombre: string;
				color_hex: string;
				es_clara: boolean;
			}[];
			categoryGroups: (Option & { children: Option[] })[];
			designs: Option[];
			collections: Option[];
		};
		values?: {
			product: Partial<ProductRecord>;
			colors: string[];
			collections: string[];
			stock: Record<string, number>;
		};
	};

	let { context, values }: Props = $props();

	const initial = $derived(values?.product ?? {});

	// Choices that change what the rest of the form shows; they reset when the data reloads.
	let tipo = $derived(initial.tipo_imagen ?? 'mockup');
	let garmentTypeId = $derived(
		initial.garment_type_id ??
			(initial.tipo_imagen === 'foto' ? '' : (context.garmentTypes[0]?.id ?? ''))
	);
	let designId = $derived(initial.design_id ?? '');
	let modo = $derived(initial.modo_stock ?? 'bajo_pedido');
	let selected = $derived(values?.colors ?? []);

	const garmentType = $derived(
		context.garmentTypes.find((type) => type.id === garmentTypeId) ?? null
	);
	const bases = $derived(context.bases.filter((base) => base.garment_type_id === garmentTypeId));
	const selectedBases = $derived(bases.filter((base) => selected.includes(base.id)));

	function toggleColor(id: string, on: boolean) {
		selected = on ? [...selected, id] : selected.filter((color) => color !== id);
	}

	function selectAll(on: boolean) {
		selected = on ? bases.map((base) => base.id) : [];
	}

	const inheritedPrice = $derived(
		garmentType?.precio_normal != null
			? `Si lo dejas vacío usa ${formatMoney(garmentType.precio_normal)} de ${garmentType.nombre.toLowerCase()}.`
			: garmentType
				? `${garmentType.nombre} todavía no tiene precio: escribe uno aquí o defínelo en Tallas y precios.`
				: 'Obligatorio: este producto no es una prenda.'
	);

	function stockValue(baseId: string, talla: string): number {
		return values?.stock[`${baseId}.${talla}`] ?? 0;
	}
</script>

<div class="flex flex-col gap-8">
	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="pf-basico">
		<h2 id="pf-basico" class="font-display text-lg text-foreground">Datos del producto</h2>
		<div class="mt-4 grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-2">
				<Label for="pf-nombre">Nombre</Label>
				<Input
					id="pf-nombre"
					name="nombre"
					required
					maxlength={80}
					value={initial.nombre ?? ''}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="pf-slug">Slug (URL)</Label>
				<Input
					id="pf-slug"
					name="slug"
					placeholder="Se genera desde el nombre"
					value={initial.slug ?? ''}
					class="min-h-11"
				/>
			</div>
			<div class="flex flex-col gap-2 sm:col-span-2">
				<Label for="pf-descripcion">Descripción</Label>
				<textarea
					id="pf-descripcion"
					name="descripcion"
					rows="3"
					maxlength="2000"
					class="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
					>{initial.descripcion ?? ''}</textarea
				>
			</div>
			<div class="flex flex-col gap-2">
				<Label for="pf-categoria">Categoría</Label>
				<select
					id="pf-categoria"
					name="category_id"
					required
					class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
				>
					<option value="" disabled selected={!initial.category_id}>Elige una categoría</option>
					{#each context.categoryGroups as group (group.id)}
						<optgroup label={group.nombre}>
							<option value={group.id} selected={initial.category_id === group.id}>
								{group.nombre} (general)
							</option>
							{#each group.children as child (child.id)}
								<option value={child.id} selected={initial.category_id === child.id}>
									{child.nombre}
								</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
		</div>

		{#if context.collections.length > 0}
			<fieldset class="mt-5">
				<legend class="text-sm font-medium text-foreground">Colecciones</legend>
				<div class="mt-2 flex flex-wrap gap-x-6">
					{#each context.collections as collection (collection.id)}
						<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
							<input
								type="checkbox"
								name="colecciones"
								value={collection.id}
								checked={values?.collections.includes(collection.id)}
								class="size-5 accent-[var(--gold)]"
							/>
							{collection.nombre}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
	</section>

	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="pf-imagen">
		<h2 id="pf-imagen" class="font-display text-lg text-foreground">Imagen</h2>
		<fieldset class="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-6">
			<legend class="sr-only">Cómo se muestra</legend>
			<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
				<input
					type="radio"
					name="tipo_imagen"
					value="mockup"
					bind:group={tipo}
					onchange={() => {
						if (!garmentTypeId) garmentTypeId = context.garmentTypes[0]?.id ?? '';
					}}
					class="size-5 accent-[var(--gold)]"
				/>
				Mockup automático (diseño sobre la prenda)
			</label>
			<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
				<input
					type="radio"
					name="tipo_imagen"
					value="foto"
					bind:group={tipo}
					class="size-5 accent-[var(--gold)]"
				/>
				Fotos reales (tazas, termos, velas…)
			</label>
		</fieldset>

		<div class="mt-4 grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-2">
				<Label for="pf-prenda">Tipo de prenda</Label>
				<select
					id="pf-prenda"
					name="garment_type_id"
					bind:value={garmentTypeId}
					onchange={() => {
						selected = [];
						if (!garmentTypeId) modo = 'bajo_pedido';
					}}
					class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
				>
					{#if tipo === 'foto'}
						<option value="">No es una prenda</option>
					{/if}
					{#each context.garmentTypes as type (type.id)}
						<option value={type.id}>{type.nombre}</option>
					{/each}
				</select>
			</div>
			{#if tipo === 'mockup'}
				<div class="flex flex-col gap-2">
					<Label for="pf-diseno">Diseño</Label>
					<select
						id="pf-diseno"
						name="design_id"
						bind:value={designId}
						required
						class="min-h-11 rounded-md border border-border bg-transparent px-3 text-sm text-foreground"
					>
						<option value="" disabled>Elige un diseño</option>
						{#each context.designs as design (design.id)}
							<option value={design.id}>{design.nombre}</option>
						{/each}
					</select>
					{#if context.designs.length === 0}
						<p class="text-xs text-warning">
							Aún no hay diseños. Súbelos en
							<a href={resolve('/admin/(panel)/disenos')} class="underline">Diseños</a>.
						</p>
					{/if}
				</div>
			{/if}
		</div>

		{#if garmentType}
			<fieldset class="mt-5">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<legend class="text-sm font-medium text-foreground">
						Colores disponibles ({selected.length} de {bases.length})
					</legend>
					<div class="flex gap-1 text-sm">
						<button
							type="button"
							onclick={() => selectAll(true)}
							class="min-h-11 rounded-md px-3 text-purple-light hover:bg-surface-raised"
							>Todos</button
						>
						<button
							type="button"
							onclick={() => selectAll(false)}
							class="min-h-11 rounded-md px-3 text-muted-foreground hover:bg-surface-raised"
							>Ninguno</button
						>
					</div>
				</div>
				{#if bases.length === 0}
					<p class="mt-2 text-sm text-muted-foreground">
						{garmentType.nombre} no tiene prendas base todavía.
					</p>
				{:else}
					<div class="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-4">
						{#each bases as base (base.id)}
							<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
								<input
									type="checkbox"
									name="colores"
									value={base.id}
									checked={selected.includes(base.id)}
									onchange={(event) => toggleColor(base.id, event.currentTarget.checked)}
									class="size-5 accent-[var(--gold)]"
								/>
								<span
									class="size-4 shrink-0 rounded-full border border-border"
									style:background-color={base.color_hex}
									aria-hidden="true"
								></span>
								{base.color_nombre}
							</label>
						{/each}
					</div>
				{/if}
			</fieldset>

			{#if tipo === 'mockup' && designId && selectedBases.length > 0}
				<div class="mt-5">
					<p class="text-sm font-medium text-foreground">Así se verá</p>
					<ul class="mt-2 flex gap-3 overflow-x-auto pb-2">
						{#each selectedBases.slice(0, 8) as base (base.id)}
							<li class="w-28 shrink-0">
								<img
									src="{resolve('/admin/(panel)/disenos/[id]/mockup/[baseId]', {
										id: designId,
										baseId: base.id
									})}?s=400"
									alt="Mockup en {base.color_nombre.toLowerCase()}"
									width="112"
									height="112"
									loading="lazy"
									draggable="false"
									class="aspect-square w-28 rounded-md border border-border bg-surface-raised"
								/>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}

		{#if tipo === 'foto'}
			<p class="mt-4 text-sm text-muted-foreground">
				Las fotos se agregan después de guardar el producto.
			</p>
		{/if}
	</section>

	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="pf-precio">
		<h2 id="pf-precio" class="font-display text-lg text-foreground">Precio e inventario</h2>
		<div class="mt-4 flex max-w-xs flex-col gap-2">
			<Label for="pf-precio-input">Precio propio (MXN)</Label>
			<Input
				id="pf-precio-input"
				name="precio"
				inputmode="decimal"
				placeholder={garmentType?.precio_normal != null
					? centsToInput(garmentType.precio_normal)
					: ''}
				value={centsToInput(initial.precio_base ?? null)}
				class="min-h-11 tabular-nums"
			/>
			<p class="text-xs text-muted-foreground">{inheritedPrice}</p>
		</div>

		<fieldset class="mt-5 flex flex-col gap-1 sm:flex-row sm:gap-6">
			<legend class="text-sm font-medium text-foreground">Disponibilidad</legend>
			<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
				<input
					type="radio"
					name="modo_stock"
					value="bajo_pedido"
					bind:group={modo}
					class="size-5 accent-[var(--gold)]"
				/>
				Bajo pedido
			</label>
			<label class="flex min-h-11 items-center gap-2 text-sm text-foreground">
				<input
					type="radio"
					name="modo_stock"
					value="stock"
					bind:group={modo}
					disabled={!garmentType}
					class="size-5 accent-[var(--gold)]"
				/>
				En stock (por color y talla)
			</label>
		</fieldset>

		{#if modo === 'stock' && garmentType}
			{#if selectedBases.length === 0}
				<p class="mt-3 text-sm text-muted-foreground">Elige colores para capturar el inventario.</p>
			{:else}
				<div class="relative mt-4 overflow-x-auto">
					<table class="text-sm">
						<thead>
							<tr class="text-left text-xs text-muted-foreground">
								<th scope="col" class="pr-3 pb-2 font-medium">Color</th>
								{#each garmentType.tallas as talla (talla)}
									<th scope="col" class="px-1 pb-2 text-center font-medium">{talla}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each selectedBases as base (base.id)}
								<tr>
									<th
										scope="row"
										class="pr-3 text-left font-normal whitespace-nowrap text-foreground"
									>
										{base.color_nombre}
									</th>
									{#each garmentType.tallas as talla (talla)}
										<td class="px-1 py-1">
											<Input
												name="stock.{base.id}.{talla}"
												type="number"
												min={0}
												max={9999}
												aria-label="{base.color_nombre} talla {talla}"
												value={stockValue(base.id, talla)}
												class="min-h-11 w-16 text-center tabular-nums"
											/>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>

	<section class="rounded-xl border border-border bg-card p-5" aria-labelledby="pf-opciones">
		<h2 id="pf-opciones" class="font-display text-lg text-foreground">Opciones</h2>
		<div class="mt-3 flex flex-col gap-1">
			<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
				<input
					type="checkbox"
					name="activo"
					checked={initial.activo ?? false}
					class="size-5 accent-[var(--gold)]"
				/>
				Visible en la tienda
			</label>
			<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
				<input
					type="checkbox"
					name="destacado"
					checked={initial.destacado ?? false}
					class="size-5 accent-[var(--gold)]"
				/>
				Destacado
			</label>
			<label class="flex min-h-11 items-center gap-3 text-sm text-foreground">
				<input
					type="checkbox"
					name="permite_personalizar"
					checked={initial.permite_personalizar ?? false}
					class="size-5 accent-[var(--gold)]"
				/>
				Se puede personalizar (texto o imagen, por cotizar)
			</label>
		</div>
	</section>
</div>
