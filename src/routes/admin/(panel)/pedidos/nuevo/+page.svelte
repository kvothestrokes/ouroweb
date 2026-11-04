<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		PackagePlus,
		Plus,
		Search,
		Sparkles,
		Trash2,
		UserCheck
	} from '@lucide/svelte';
	import FormMessage from '#lib/components/admin/FormMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { DELIVERY_METHODS, type DeliveryMethod } from '#lib/domain/checkout.js';
	import { centsToInput, formatMoney, parseMoney } from '#lib/domain/money.js';
	import {
		PAYMENT_TYPES,
		type PaymentType,
		type RecurringCustomer
	} from '#lib/domain/order-admin.js';
	import { suggestedDeposit } from '#lib/domain/order-money.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type DraftLine = {
		key: string;
		product_id: string | null;
		nombre_snapshot: string;
		color: string;
		talla: string;
		cantidad: number;
		precio_pesos: string;
		recargo_pesos: string;
		personalizacion_texto: string;
	};

	let busy = $state(false);
	let tipo = $state<'catalogo' | 'encargo'>('catalogo');
	let estadoInicial = $state<'pendiente' | 'esperando_anticipo' | 'confirmado'>('pendiente');

	// Customer & Delivery state
	let customerSearch = $state('');
	let clienteNombre = $state('');
	let clienteWhatsapp = $state('');
	let metodoEntrega = $state<DeliveryMethod>('recoger');
	let calle = $state('');
	let colonia = $state('');
	let cp = $state('');
	let ciudad = $state('');
	let estadoDir = $state('Chiapas');
	let referencias = $state('');
	let notasCliente = $state('');

	// Catalog lines state
	let selectedProductId = $state('');
	let lines = $state<DraftLine[]>([
		{
			key: crypto.randomUUID(),
			product_id: null,
			nombre_snapshot: '',
			color: '',
			talla: '',
			cantidad: 1,
			precio_pesos: '',
			recargo_pesos: '0',
			personalizacion_texto: ''
		}
	]);

	// Custom request state
	let customRequestTypeId = $state('');
	let encargoDescripcion = $state('');
	let encargoCantidad = $state(1);
	let encargoFechaDeseada = $state('');
	let encargoPrecioFinal = $state('');

	// Financial & Initial payment state
	let descMayoreoPesos = $state('0');
	let descCuponPesos = $state('0');
	let personalizacionPesos = $state('');
	let envioPesos = $state('');
	let anticipoPesos = $state('');

	let registrarPagoInicial = $state(false);
	let pagoInicialTipo = $state<PaymentType>('anticipo');
	let pagoInicialMonto = $state('');
	let pagoInicialMetodo = $state('Transferencia');

	const filteredCustomers = $derived.by(() => {
		const q = customerSearch.trim().toLowerCase();
		if (!q) return data.customers.slice(0, 6);
		return data.customers
			.filter(
				(c) =>
					c.cliente_nombre.toLowerCase().includes(q) ||
					c.whatsapp_nacional.includes(q.replace(/\D/g, ''))
			)
			.slice(0, 8);
	});

	function applyCustomer(customer: RecurringCustomer) {
		clienteNombre = customer.cliente_nombre;
		clienteWhatsapp = customer.whatsapp_nacional;
		metodoEntrega = customer.metodo_entrega;
		if (customer.direccion) {
			calle = customer.direccion.calle;
			colonia = customer.direccion.colonia;
			cp = customer.direccion.cp;
			ciudad = customer.direccion.ciudad;
			estadoDir = customer.direccion.estado;
			referencias = customer.direccion.referencias ?? '';
		}
		customerSearch = '';
	}

	function catalogProductById(id: string | null) {
		if (!id) return null;
		return data.catalogProducts.find((p) => p.id === id) ?? null;
	}

	function addCatalogProduct() {
		const prod = catalogProductById(selectedProductId);
		if (!prod) return;
		const defaultSize = prod.tallas[0] ?? '';
		const defaultSurcharge = defaultSize ? (prod.recargos[defaultSize] ?? 0) : 0;
		const newLine: DraftLine = {
			key: crypto.randomUUID(),
			product_id: prod.id,
			nombre_snapshot: prod.nombre,
			color: prod.colores[0] ?? '',
			talla: defaultSize,
			cantidad: 1,
			precio_pesos: centsToInput(prod.precio_unitario),
			recargo_pesos: centsToInput(defaultSurcharge) || '0',
			personalizacion_texto: ''
		};
		if (lines.length === 1 && !lines[0].nombre_snapshot.trim() && !lines[0].precio_pesos.trim()) {
			lines = [newLine];
		} else {
			lines = [...lines, newLine];
		}
		selectedProductId = '';
	}

	function addFreeLine() {
		lines = [
			...lines,
			{
				key: crypto.randomUUID(),
				product_id: null,
				nombre_snapshot: '',
				color: '',
				talla: '',
				cantidad: 1,
				precio_pesos: '',
				recargo_pesos: '0',
				personalizacion_texto: ''
			}
		];
	}

	function removeLine(key: string) {
		if (lines.length <= 1) return;
		lines = lines.filter((line) => line.key !== key);
	}

	function onSizeChange(line: DraftLine, newSize: string) {
		line.talla = newSize;
		const prod = catalogProductById(line.product_id);
		if (prod && newSize in prod.recargos) {
			line.recargo_pesos = centsToInput(prod.recargos[newSize] ?? 0) || '0';
		}
	}

	const toCentsSafe = (val: string): number => {
		const parsed = parseMoney(val);
		return parsed === null || Number.isNaN(parsed) ? 0 : parsed;
	};

	const subtotalCents = $derived.by(() => {
		if (tipo === 'encargo') {
			return toCentsSafe(encargoPrecioFinal);
		}
		return lines.reduce((sum, line) => {
			const unit = toCentsSafe(line.precio_pesos);
			const sur = toCentsSafe(line.recargo_pesos);
			const qty = Math.max(1, Number(line.cantidad) || 1);
			return sum + (unit + sur) * qty;
		}, 0);
	});

	const discountsCents = $derived(toCentsSafe(descMayoreoPesos) + toCentsSafe(descCuponPesos));
	const shippingCents = $derived(metodoEntrega === 'recoger' ? 0 : toCentsSafe(envioPesos));
	const customCents = $derived(toCentsSafe(personalizacionPesos));
	const totalCents = $derived(
		Math.max(0, subtotalCents - discountsCents + shippingCents + customCents)
	);
	const suggestedDepositCents = $derived(suggestedDeposit(totalCents, data.suggestedPct));

	const itemsJson = $derived(
		JSON.stringify(
			lines.map((line) => ({
				product_id: line.product_id,
				nombre_snapshot: line.nombre_snapshot,
				color: line.color || null,
				talla: line.talla || null,
				cantidad: Number(line.cantidad) || 1,
				precio_pesos: line.precio_pesos,
				recargo_pesos: line.recargo_pesos || '0',
				personalizacion_texto: line.personalizacion_texto || null
			}))
		)
	);

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update }) => {
			await update();
			busy = false;
		};
	};

	const card = 'rounded-xl border border-border bg-card p-5';
	const heading = 'mb-4 font-display text-lg text-foreground';
	const selectClass =
		'min-h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground';
</script>

<svelte:head>
	<title>Nuevo pedido manual · Panel Ouroboros</title>
</svelte:head>

<a
	href={resolve('/admin/(panel)/pedidos')}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" /> Volver a pedidos
</a>

<div class="mt-2 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="font-display text-2xl text-foreground md:text-3xl">Nuevo pedido manual</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Registra ventas de WhatsApp, Instagram o taller con folio oficial y cálculo automático.
		</p>
	</div>
</div>

<div class="fixed inset-x-4 bottom-4 z-40 lg:static lg:inset-auto" aria-live="polite">
	<FormMessage error={form?.message} class="mt-4 shadow-lg lg:shadow-none" />
</div>

<form
	method="POST"
	use:enhance={submit}
	class="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr] lg:items-start"
>
	<input type="hidden" name="tipo" value={tipo} />
	<input type="hidden" name="items_json" value={itemsJson} />

	<div class="flex flex-col gap-6">
		<!-- 1. Tipo de pedido y partidas -->
		<section class={card}>
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h2 class="font-display text-lg text-foreground">1. Tipo y productos del pedido</h2>
				<div class="inline-flex rounded-lg border border-border bg-surface-raised p-1">
					<button
						type="button"
						class="min-h-10 rounded-md px-3 text-sm font-medium transition-colors {tipo ===
						'catalogo'
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => (tipo = 'catalogo')}
					>
						Catálogo / Partidas
					</button>
					<button
						type="button"
						class="min-h-10 rounded-md px-3 text-sm font-medium transition-colors {tipo ===
						'encargo'
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => (tipo = 'encargo')}
					>
						Encargo especial
					</button>
				</div>
			</div>

			{#if tipo === 'catalogo'}
				<!-- Quick catalog picker -->
				<div class="mb-4 rounded-lg border border-border bg-surface-raised/60 p-3">
					<Label for="catalog-picker" class="mb-2 block text-xs text-muted-foreground">
						Autocompletar desde el catálogo o agregar partida libre
					</Label>
					<div class="flex flex-wrap gap-2">
						<select
							id="catalog-picker"
							bind:value={selectedProductId}
							class="min-h-11 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground"
						>
							<option value="">Elegir producto del catálogo…</option>
							{#each data.catalogProducts as prod (prod.id)}
								<option value={prod.id}>
									{prod.nombre}
									{prod.prenda ? `(${prod.prenda})` : ''} — {formatMoney(prod.precio_unitario)}
									{!prod.activo ? '[Inactivo]' : ''}
								</option>
							{/each}
						</select>
						<Button
							type="button"
							variant="outline"
							class="min-h-11"
							disabled={!selectedProductId}
							onclick={addCatalogProduct}
						>
							<PackagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
							Agregar del catálogo
						</Button>
						<Button type="button" variant="outline" class="min-h-11" onclick={addFreeLine}>
							<Plus size={18} strokeWidth={1.75} aria-hidden="true" />
							Partida libre
						</Button>
					</div>
				</div>

				<!-- Line items editor -->
				<div class="flex flex-col gap-4">
					{#each lines as line, idx (line.key)}
						{@const catalogProd = catalogProductById(line.product_id)}
						<div class="rounded-lg border border-border bg-surface-raised/30 p-4">
							<div class="mb-3 flex items-center justify-between gap-2">
								<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
									Partida #{idx + 1}
									{#if catalogProd}
										<span
											class="ml-1 rounded bg-accent/20 px-1.5 py-0.5 text-purple-light normal-case"
										>
											Catálogo
										</span>
									{:else}
										<span class="ml-1 rounded border border-border px-1.5 py-0.5 normal-case">
											Libre
										</span>
									{/if}
								</span>
								{#if lines.length > 1}
									<button
										type="button"
										class="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs text-danger hover:bg-danger/10"
										onclick={() => removeLine(line.key)}
									>
										<Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
										Quitar
									</button>
								{/if}
							</div>

							<div class="grid gap-3 sm:grid-cols-6">
								<div class="flex flex-col gap-1.5 sm:col-span-3">
									<Label for="nombre-{line.key}">Producto / Concepto</Label>
									<Input
										id="nombre-{line.key}"
										bind:value={line.nombre_snapshot}
										placeholder="Ej. Playera Akatsuki o Termo grabado"
										required
										class="min-h-11"
									/>
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-1">
									<Label for="cantidad-{line.key}">Cantidad</Label>
									<Input
										id="cantidad-{line.key}"
										type="number"
										min="1"
										max="999"
										bind:value={line.cantidad}
										required
										class="min-h-11 tabular-nums"
									/>
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-1">
									<Label for="precio-{line.key}">Precio u. ($)</Label>
									<Input
										id="precio-{line.key}"
										inputmode="decimal"
										bind:value={line.precio_pesos}
										placeholder="170"
										required
										class="min-h-11 tabular-nums"
									/>
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-1">
									<Label for="recargo-{line.key}">Recargo ($)</Label>
									<Input
										id="recargo-{line.key}"
										inputmode="decimal"
										bind:value={line.recargo_pesos}
										placeholder="0"
										class="min-h-11 tabular-nums"
									/>
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-2">
									<Label for="color-{line.key}">Color (opcional)</Label>
									{#if catalogProd && catalogProd.colores.length > 0}
										<select id="color-{line.key}" bind:value={line.color} class={selectClass}>
											<option value="">Sin color</option>
											{#each catalogProd.colores as colorName (colorName)}
												<option value={colorName}>{colorName}</option>
											{/each}
										</select>
									{:else}
										<Input
											id="color-{line.key}"
											bind:value={line.color}
											placeholder="Ej. Negro"
											class="min-h-11"
										/>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-2">
									<Label for="talla-{line.key}">Talla (opcional)</Label>
									{#if catalogProd && catalogProd.tallas.length > 0}
										<select
											id="talla-{line.key}"
											value={line.talla}
											onchange={(e) => onSizeChange(line, e.currentTarget.value)}
											class={selectClass}
										>
											<option value="">Sin talla</option>
											{#each catalogProd.tallas as sizeName (sizeName)}
												<option value={sizeName}>{sizeName}</option>
											{/each}
										</select>
									{:else}
										<Input
											id="talla-{line.key}"
											bind:value={line.talla}
											placeholder="CH, M, G, XG…"
											class="min-h-11 uppercase"
										/>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5 sm:col-span-2">
									<Label for="pers-{line.key}">Personalización en prenda</Label>
									<Input
										id="pers-{line.key}"
										bind:value={line.personalizacion_texto}
										placeholder="Texto o detalle extra"
										class="min-h-11"
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Special Request ('encargo') fields -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-2">
						<Label for="custom_request_type_id">Tipo de encargo</Label>
						<select
							id="custom_request_type_id"
							name="custom_request_type_id"
							bind:value={customRequestTypeId}
							class={selectClass}
						>
							<option value="">Otro / General</option>
							{#each data.requestTypes as rt (rt.id)}
								<option value={rt.id}>
									{rt.nombre}
									{rt.precio_desde != null ? `(desde ${formatMoney(rt.precio_desde)})` : ''}
								</option>
							{/each}
						</select>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="cantidad">Cantidad de piezas</Label>
						<Input
							id="cantidad"
							name="cantidad"
							type="number"
							min="1"
							max="999"
							bind:value={encargoCantidad}
							required
							class="min-h-11 tabular-nums"
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="fecha_deseada">Fecha deseada (opcional)</Label>
						<Input
							id="fecha_deseada"
							name="fecha_deseada"
							type="date"
							bind:value={encargoFechaDeseada}
							class="min-h-11 [color-scheme:dark]"
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="precio_final">Precio acordado MXN (vacío = por cotizar)</Label>
						<Input
							id="precio_final"
							name="precio_final"
							inputmode="decimal"
							bind:value={encargoPrecioFinal}
							placeholder="Por cotizar"
							class="min-h-11 tabular-nums"
						/>
					</div>

					<div class="flex flex-col gap-2 sm:col-span-2">
						<Label for="descripcion">Descripción detallada del encargo</Label>
						<textarea
							id="descripcion"
							name="descripcion"
							rows="4"
							maxlength="1000"
							bind:value={encargoDescripcion}
							required
							placeholder="Medidas, colores, materiales, idea del cliente…"
							class="rounded-md border border-border bg-transparent p-3 text-sm text-foreground"
						></textarea>
					</div>
				</div>
			{/if}
		</section>

		<!-- 2. Cliente y entrega (con autocompletado QoL) -->
		<section class={card}>
			<h2 class={heading}>2. Cliente y método de entrega</h2>

			{#if data.customers.length > 0}
				<div class="mb-4 rounded-lg border border-border bg-surface-raised/60 p-3">
					<Label
						for="customer-search"
						class="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
					>
						<UserCheck size={15} strokeWidth={1.75} class="text-gold" aria-hidden="true" />
						Autocompletar cliente frecuente (busca por nombre o WhatsApp)
					</Label>
					<div class="relative">
						<Search
							size={16}
							strokeWidth={1.75}
							class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							id="customer-search"
							type="search"
							bind:value={customerSearch}
							placeholder="Escribe nombre o últimos dígitos para rellenar datos…"
							class="min-h-10 pl-9 text-sm"
						/>
					</div>
					{#if filteredCustomers.length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each filteredCustomers as customer (customer.cliente_whatsapp)}
								<button
									type="button"
									class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:border-gold hover:bg-surface-raised"
									onclick={() => applyCustomer(customer)}
								>
									<span class="font-medium">{customer.cliente_nombre}</span>
									<span class="text-muted-foreground tabular-nums"
										>{customer.whatsapp_nacional}</span
									>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-2">
					<Label for="cliente_nombre">Nombre del cliente</Label>
					<Input
						id="cliente_nombre"
						name="cliente_nombre"
						bind:value={clienteNombre}
						maxlength={80}
						required
						placeholder="Ej. Sofía Hernández"
						class="min-h-11"
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="cliente_whatsapp">WhatsApp (10 dígitos)</Label>
					<Input
						id="cliente_whatsapp"
						name="cliente_whatsapp"
						type="tel"
						inputmode="numeric"
						bind:value={clienteWhatsapp}
						required
						placeholder="961 123 4567"
						class="min-h-11 tabular-nums"
					/>
				</div>

				<div class="flex flex-col gap-2 sm:col-span-2">
					<Label for="metodo_entrega">Método de entrega</Label>
					<select
						id="metodo_entrega"
						name="metodo_entrega"
						bind:value={metodoEntrega}
						class={selectClass}
					>
						{#each DELIVERY_METHODS as method (method.value)}
							<option value={method.value}>{method.label}</option>
						{/each}
					</select>
				</div>

				{#if metodoEntrega !== 'recoger'}
					<div class="flex flex-col gap-2 sm:col-span-2">
						<Label for="calle">Calle y número</Label>
						<Input
							id="calle"
							name="calle"
							bind:value={calle}
							maxlength={120}
							required
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="colonia">Colonia</Label>
						<Input
							id="colonia"
							name="colonia"
							bind:value={colonia}
							maxlength={80}
							required
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="cp">Código postal (5 dígitos)</Label>
						<Input
							id="cp"
							name="cp"
							inputmode="numeric"
							bind:value={cp}
							maxlength={5}
							required
							class="min-h-11 tabular-nums"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="ciudad">Ciudad / Municipio</Label>
						<Input
							id="ciudad"
							name="ciudad"
							bind:value={ciudad}
							maxlength={80}
							required
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<Label for="estado">Estado</Label>
						<Input
							id="estado"
							name="estado"
							bind:value={estadoDir}
							maxlength={60}
							required
							class="min-h-11"
						/>
					</div>
					<div class="flex flex-col gap-2 sm:col-span-2">
						<Label for="referencias">Referencias de entrega (opcional)</Label>
						<Input
							id="referencias"
							name="referencias"
							bind:value={referencias}
							maxlength={200}
							placeholder="Entre qué calles, color de fachada…"
							class="min-h-11"
						/>
					</div>
				{/if}

				<div class="flex flex-col gap-2 sm:col-span-2">
					<Label for="notas_cliente">Notas del pedido / cliente (opcional)</Label>
					<textarea
						id="notas_cliente"
						name="notas_cliente"
						rows="2"
						maxlength="500"
						bind:value={notasCliente}
						placeholder="Indicaciones especiales de empaque, horario o entrega…"
						class="rounded-md border border-border bg-transparent p-3 text-sm text-foreground"
					></textarea>
				</div>
			</div>
		</section>
	</div>

	<!-- Columna derecha: Cotización, descuentos, pago inicial y resumen -->
	<div class="flex flex-col gap-6">
		<section class={card}>
			<h2 class={heading}>3. Totales, descuentos y anticipo</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-2">
					<Label for="desc_mayoreo">Descuento mayoreo ($)</Label>
					<Input
						id="desc_mayoreo"
						name="desc_mayoreo"
						inputmode="decimal"
						bind:value={descMayoreoPesos}
						placeholder="0"
						class="min-h-11 tabular-nums"
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="desc_cupon">Descuento especial / cupón ($)</Label>
					<Input
						id="desc_cupon"
						name="desc_cupon"
						inputmode="decimal"
						bind:value={descCuponPesos}
						placeholder="0"
						class="min-h-11 tabular-nums"
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="personalizacion">Cargo personalización ($)</Label>
					<Input
						id="personalizacion"
						name="personalizacion"
						inputmode="decimal"
						bind:value={personalizacionPesos}
						placeholder="Por cotizar"
						class="min-h-11 tabular-nums"
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="envio">Costo de envío ($)</Label>
					<Input
						id="envio"
						name="envio"
						inputmode="decimal"
						value={metodoEntrega === 'recoger' ? '0' : envioPesos}
						oninput={(e) => (envioPesos = e.currentTarget.value)}
						disabled={metodoEntrega === 'recoger'}
						placeholder={metodoEntrega === 'recoger' ? '0 (Recoger)' : 'Por cotizar'}
						class="min-h-11 tabular-nums"
					/>
				</div>

				<div class="flex flex-col gap-2 sm:col-span-2">
					<div class="flex items-center justify-between gap-2">
						<Label for="anticipo_requerido">Anticipo requerido ($)</Label>
						{#if suggestedDepositCents > 0}
							<button
								type="button"
								class="inline-flex items-center gap-1 text-xs text-gold hover:underline"
								onclick={() => (anticipoPesos = centsToInput(suggestedDepositCents))}
							>
								<Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
								Usar {data.suggestedPct}% sugerido ({formatMoney(suggestedDepositCents)})
							</button>
						{/if}
					</div>
					<Input
						id="anticipo_requerido"
						name="anticipo_requerido"
						inputmode="decimal"
						bind:value={anticipoPesos}
						placeholder="Sugerido: {centsToInput(suggestedDepositCents)}"
						class="min-h-11 tabular-nums"
					/>
				</div>
			</div>

			<dl class="mt-5 grid grid-cols-2 gap-1.5 rounded-lg bg-surface-raised p-4 text-sm">
				<dt class="text-muted-foreground">Subtotal</dt>
				<dd class="text-right tabular-nums">{formatMoney(subtotalCents)}</dd>
				{#if discountsCents > 0}
					<dt class="text-muted-foreground">Descuentos</dt>
					<dd class="text-right text-success tabular-nums">−{formatMoney(discountsCents)}</dd>
				{/if}
				{#if customCents > 0}
					<dt class="text-muted-foreground">Personalización</dt>
					<dd class="text-right tabular-nums">{formatMoney(customCents)}</dd>
				{/if}
				{#if metodoEntrega !== 'recoger' && shippingCents > 0}
					<dt class="text-muted-foreground">Envío</dt>
					<dd class="text-right tabular-nums">{formatMoney(shippingCents)}</dd>
				{/if}
				<dt class="pt-1 font-medium text-foreground">Total del pedido</dt>
				<dd class="pt-1 text-right text-lg font-bold text-gold tabular-nums">
					{formatMoney(totalCents)}
				</dd>
			</dl>
		</section>

		<!-- 4. Estado inicial y pago en un paso -->
		<section class={card}>
			<h2 class={heading}>4. Estado inicial y pago</h2>

			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="estado_inicial">Estado con el que nace el pedido</Label>
					<select
						id="estado_inicial"
						name="estado_inicial"
						bind:value={estadoInicial}
						onchange={() => {
							if (estadoInicial === 'confirmado') {
								registrarPagoInicial = true;
								pagoInicialTipo = 'anticipo';
								if (!pagoInicialMonto) {
									pagoInicialMonto = anticipoPesos || centsToInput(suggestedDepositCents);
								}
							}
						}}
						class={selectClass}
					>
						<option value="pendiente">Pendiente (por revisar / cotizar)</option>
						<option value="esperando_anticipo">Esperando anticipo (ya cotizado)</option>
						<option value="confirmado">Confirmado (ya dejó anticipo)</option>
					</select>
				</div>

				<label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-foreground">
					<input type="checkbox" bind:checked={registrarPagoInicial} class="size-4 accent-gold" />
					Registrar pago recibido ahora mismo
				</label>

				{#if registrarPagoInicial}
					<div
						class="grid gap-3 rounded-lg border border-border bg-surface-raised/50 p-4 sm:grid-cols-2"
					>
						<div class="flex flex-col gap-1.5">
							<Label for="pago_inicial_tipo">Tipo de pago</Label>
							<select
								id="pago_inicial_tipo"
								name="pago_inicial_tipo"
								bind:value={pagoInicialTipo}
								class={selectClass}
							>
								{#each PAYMENT_TYPES as pt (pt.value)}
									<option value={pt.value}>{pt.label}</option>
								{/each}
							</select>
						</div>

						<div class="flex flex-col gap-1.5">
							<Label for="pago_inicial_monto">Monto recibido ($)</Label>
							<Input
								id="pago_inicial_monto"
								name="pago_inicial_monto"
								inputmode="decimal"
								bind:value={pagoInicialMonto}
								required={registrarPagoInicial}
								placeholder={anticipoPesos || centsToInput(suggestedDepositCents)}
								class="min-h-11 tabular-nums"
							/>
						</div>

						<div class="flex flex-wrap gap-1.5 sm:col-span-2">
							{#if suggestedDepositCents > 0}
								<button
									type="button"
									class="rounded border border-border bg-card px-2.5 py-1 text-xs hover:border-gold"
									onclick={() => {
										pagoInicialTipo = 'anticipo';
										pagoInicialMonto = anticipoPesos || centsToInput(suggestedDepositCents);
									}}
								>
									Usar anticipo ({formatMoney(toCentsSafe(anticipoPesos) || suggestedDepositCents)})
								</button>
							{/if}
							{#if totalCents > 0}
								<button
									type="button"
									class="rounded border border-border bg-card px-2.5 py-1 text-xs hover:border-gold"
									onclick={() => {
										pagoInicialTipo = 'anticipo';
										pagoInicialMonto = centsToInput(totalCents);
									}}
								>
									100% pagado ({formatMoney(totalCents)})
								</button>
							{/if}
						</div>

						<div class="flex flex-col gap-1.5 sm:col-span-2">
							<Label for="pago_inicial_metodo">Método de pago</Label>
							<Input
								id="pago_inicial_metodo"
								name="pago_inicial_metodo"
								bind:value={pagoInicialMetodo}
								maxlength={60}
								placeholder="Transferencia, Efectivo en taller, Depósito…"
								class="min-h-11"
							/>
						</div>
					</div>
				{/if}

				<Button type="submit" class="mt-2 min-h-11 w-full" disabled={busy}>
					Crear pedido manual
				</Button>
			</div>
		</section>
	</div>
</form>
