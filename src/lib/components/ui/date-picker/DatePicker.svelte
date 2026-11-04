<script lang="ts">
	import { parseDate, today, type DateValue } from '@internationalized/date';
	import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { Calendar, Popover } from 'bits-ui';
	import { cn } from '#lib/utils.js';

	type Props = {
		name?: string;
		value?: string;
		min?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
	};

	let {
		name = 'fecha_deseada',
		value = $bindable(''),
		min,
		placeholder = 'Selecciona una fecha',
		required = false,
		disabled = false,
		class: className
	}: Props = $props();

	let open = $state(false);

	const timeZone = 'America/Mexico_City';
	const todayDate = today(timeZone);

	const minDateValue = $derived.by(() => {
		if (!min) return todayDate;
		try {
			return parseDate(min);
		} catch {
			return todayDate;
		}
	});

	let calendarValue = $state<DateValue | undefined>(undefined);

	$effect(() => {
		if (value) {
			try {
				calendarValue = parseDate(value);
			} catch {
				calendarValue = undefined;
			}
		} else {
			calendarValue = undefined;
		}
	});

	function handleSelect(newDate: DateValue | undefined) {
		calendarValue = newDate;
		value = newDate ? newDate.toString() : '';
		open = false;
	}

	function setPreset(daysOffset: number | null) {
		if (daysOffset === null) {
			handleSelect(undefined);
			return;
		}
		const target = todayDate.add({ days: daysOffset });
		handleSelect(target);
	}

	const displayLabel = $derived.by(() => {
		if (!calendarValue) return null;
		try {
			const jsDate = new Date(
				calendarValue.year,
				calendarValue.month - 1,
				calendarValue.day,
				12,
				0,
				0
			);
			const formatted = new Intl.DateTimeFormat('es-MX', {
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			}).format(jsDate);
			return formatted.charAt(0).toUpperCase() + formatted.slice(1);
		} catch {
			return value;
		}
	});

	// Days diff for lead time notice
	const daysUntil = $derived.by(() => {
		if (!calendarValue) return null;
		const diffMs =
			new Date(calendarValue.year, calendarValue.month - 1, calendarValue.day).getTime() -
			new Date(todayDate.year, todayDate.month - 1, todayDate.day).getTime();
		return Math.round(diffMs / (1000 * 60 * 60 * 24));
	});
</script>

<div class={cn('relative flex flex-col gap-1.5', className)}>
	<!-- Native input keeping form action compatibility -->
	<input type="hidden" {name} {value} {required} />

	<Popover.Root bind:open>
		<Popover.Trigger
			{disabled}
			class={cn(
				'flex h-12 w-full items-center justify-between rounded-lg border border-border bg-surface px-3.5 text-base text-foreground transition-all hover:border-gold/60 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30',
				!value && 'text-muted-foreground',
				disabled && 'cursor-not-allowed opacity-50'
			)}
			aria-label="Elegir fecha de entrega deseada"
		>
			<span class="flex items-center gap-2.5 truncate">
				<CalendarIcon size={18} class="shrink-0 text-gold" />
				{#if displayLabel}
					<span class="font-medium text-foreground">{displayLabel}</span>
				{:else}
					<span>{placeholder}</span>
				{/if}
			</span>

			{#if value && !disabled}
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						handleSelect(undefined);
					}}
					aria-label="Quitar fecha"
					class="ml-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
				>
					<X size={15} />
				</button>
			{/if}
		</Popover.Trigger>

		<Popover.Portal>
			<Popover.Content
				class="z-50 w-auto animate-in rounded-2xl border border-border bg-surface p-4 shadow-xl backdrop-blur-md fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
				sideOffset={6}
			>
				<!-- Quick Preset Chips -->
				<div class="mb-4 flex flex-wrap gap-1.5 border-b border-border/60 pb-3">
					<button
						type="button"
						onclick={() => setPreset(4)}
						class="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold hover:text-gold"
					>
						⚡ Estándar (4 días)
					</button>
					<button
						type="button"
						onclick={() => setPreset(7)}
						class="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold hover:text-gold"
					>
						📅 En 1 semana
					</button>
					<button
						type="button"
						onclick={() => setPreset(14)}
						class="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold hover:text-gold"
					>
						🕒 En 2 semanas
					</button>
					{#if value}
						<button
							type="button"
							onclick={() => setPreset(null)}
							class="rounded-full border border-danger/30 px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10"
						>
							Sin fecha fija
						</button>
					{/if}
				</div>

				<!-- Calendar Grid -->
				<Calendar.Root
					type="single"
					value={calendarValue}
					onValueChange={handleSelect}
					minValue={minDateValue}
					locale="es-MX"
					class="w-68 select-none"
				>
					{#snippet children({ months, weekdays })}
						<Calendar.Header class="flex items-center justify-between pb-3">
							<Calendar.PrevButton
								class="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:border-gold hover:text-gold"
							>
								<ChevronLeft size={16} />
							</Calendar.PrevButton>
							<Calendar.Heading
								class="font-display text-sm font-semibold text-foreground capitalize"
							/>
							<Calendar.NextButton
								class="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:border-gold hover:text-gold"
							>
								<ChevronRight size={16} />
							</Calendar.NextButton>
						</Calendar.Header>

						{#each months as month (month.value.toString())}
							<Calendar.Grid class="w-full border-collapse">
								<Calendar.GridHead>
									<Calendar.GridRow class="mb-1.5 grid grid-cols-7">
										{#each weekdays as day, i (i)}
											<Calendar.HeadCell
												class="text-center text-xs font-medium text-muted-foreground"
											>
												{day}
											</Calendar.HeadCell>
										{/each}
									</Calendar.GridRow>
								</Calendar.GridHead>
								<Calendar.GridBody>
									{#each month.weeks as weekDates, i (i)}
										<Calendar.GridRow class="grid grid-cols-7">
											{#each weekDates as date (date.toString())}
												<Calendar.Cell {date} month={month.value} class="p-0.5 text-center">
													<Calendar.Day
														class="grid size-8.5 place-items-center rounded-lg text-xs font-medium text-foreground transition-colors hover:bg-gold-fill/20 data-[disabled]:pointer-events-none data-[disabled]:opacity-20 data-[selected]:bg-gold-fill data-[selected]:font-bold data-[selected]:text-on-gold data-[unavailable]:line-through"
													>
														{date.day}
													</Calendar.Day>
												</Calendar.Cell>
											{/each}
										</Calendar.GridRow>
									{/each}
								</Calendar.GridBody>
							</Calendar.Grid>
						{/each}
					{/snippet}
				</Calendar.Root>

				<!-- Lead time helper -->
				<div class="mt-3 border-t border-border/60 pt-2 text-center text-xs text-muted-foreground">
					{#if daysUntil !== null}
						{#if daysUntil <= 2}
							<span class="font-medium text-warning">
								⚠️ Muy poco tiempo: sujeto a disponibilidad inmediata en taller.
							</span>
						{:else if daysUntil <= 5}
							<span class="text-foreground"
								>✨ Tiempo estándar de preparación y personalización.</span
							>
						{:else}
							<span class="text-success">✅ Excelente margen para producción y detalles finos.</span
							>
						{/if}
					{:else}
						<span>El taller requiere un mínimo de 3 a 5 días hábiles.</span>
					{/if}
				</div>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</div>
