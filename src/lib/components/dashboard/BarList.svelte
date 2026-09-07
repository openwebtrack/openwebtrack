<script lang="ts">
	import { getCurrencySymbol } from '$lib/utils/currency';

	let { items = [], revenueItems = [], customerItems = [], websiteCurrency = 'USD' } = $props();

	let currencySymbol = $derived(getCurrencySymbol(websiteCurrency));
	let isZeroDecimal = $derived(websiteCurrency === 'JPY' || websiteCurrency === 'KRW' || websiteCurrency === 'VND' || websiteCurrency === 'IDR');

	let maxVal = $derived(Math.max(...items.map((i: any) => i.value)));
	let maxRevenue = $derived(revenueItems.length > 0 ? Math.max(...revenueItems.map((r: any) => r.value)) : 0);

	const getRevenue = (label: string): { value: number; exists: boolean } => {
		const match = revenueItems.find((r: any) => r.label === label);
		return match ? { value: match.value, exists: true } : { value: 0, exists: false };
	};

	const getCustomers = (label: string): number => {
		const match = (customerItems || []).find((c: any) => c.label === label);
		return match ? match.value : 0;
	};

	const formatRevenue = (val: number): string => {
		if (isZeroDecimal) {
			return `${currencySymbol}${Math.round(val).toLocaleString()}`;
		}
		const displayVal = val / 100;
		return `${currencySymbol}${displayVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	};

	const formatRevPerVisitor = (revenue: number, visitors: number): string => {
		if (visitors === 0) return `${currencySymbol}0.00`;
		const val = revenue / visitors;
		if (isZeroDecimal) {
			return `${currencySymbol}${Math.round(val).toLocaleString()}`;
		}
		const displayVal = val / 100;
		return `${currencySymbol}${displayVal.toFixed(2)}`;
	};

	const formatConversionRate = (customers: number, visitors: number): string => {
		if (visitors === 0) return '0.00%';
		return `${((customers / visitors) * 100).toFixed(2)}%`;
	};

	const formatVisitors = (val: number): string => {
		return val.toLocaleString();
	};

	const formatLabel = (label: string): { key: string; value: string }[] => {
		if (!label.startsWith('?')) return [];
		const params = label.slice(1).split('&');
		return params.map((p) => {
			const [key, value] = p.split('=');
			return { key: key || '', value: value || '' };
		});
	};

	let hoveredLabel = $state<string | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	const handleMouseEnter = (e: MouseEvent, label: string) => {
		hoveredLabel = label;
		updateTooltipPos(e);
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (hoveredLabel) updateTooltipPos(e);
	};

	const updateTooltipPos = (e: MouseEvent) => {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	};
</script>

{#if hoveredLabel}
	{@const item = items.find((i: any) => i.label === hoveredLabel)}
	{#if item}
		{@const revenue = getRevenue(item.label)}
		<div
			class="pointer-events-none fixed z-9999 w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-2xl border border-border bg-popover p-3 shadow-floating"
			style="left: {tooltipX}px; top: {tooltipY}px; animation: tooltipIn 0.1s ease-out both;"
		>
			<div class="mb-2.5 flex items-center gap-1.5 border-b border-border pb-2.5">
				{#if item.icon}
					<img src={item.icon} alt="" class="h-4 w-4 rounded-sm object-contain" />
				{/if}
				<span class="truncate text-xs font-medium text-foreground">{item.label}</span>
			</div>

			<div class="flex flex-col gap-1.5">
				<div class="flex items-center justify-between gap-4 text-xs text-muted-foreground">
					<div class="flex items-center gap-2">
						<div class="h-1.5 w-1.5 rounded-full bg-primary"></div>
						<span>Visitors</span>
					</div>
					<span class="font-medium tabular-nums text-foreground">{formatVisitors(item.value)}</span>
				</div>
				<div class="flex items-center justify-between gap-4 text-xs text-muted-foreground">
					<div class="flex items-center gap-2">
						<div class="h-1.5 w-1.5 rounded-full bg-[#60a5fa]"></div>
						<span>Revenue</span>
					</div>
					<span class="font-medium tabular-nums text-foreground">{formatRevenue(revenue.value ?? 0)}</span>
				</div>

				<div class="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1.5 text-xs text-muted-foreground">
					<span>Rev / Visitor</span>
					<span class="font-medium tabular-nums text-foreground">{formatRevPerVisitor(revenue.value ?? 0, item.value)}</span>
				</div>
				<div class="flex items-center justify-between gap-4 text-xs text-muted-foreground">
					<span>Conv. rate</span>
					<span class="font-medium tabular-nums text-foreground">{formatConversionRate(getCustomers(item.label), item.value)}</span>
				</div>
			</div>
		</div>
	{/if}
{/if}

<div class="flex flex-col gap-0.5">
	{#each items as item}
		{@const revenue = getRevenue(item.label)}
		{@const hasRevenue = revenue.exists}
		{@const visitorsWidth = (item.value / maxVal) * 100}
		{@const revenueWidth = maxRevenue > 0 ? revenue.value / (maxRevenue / 100) : 0}

		<div
			class="group relative flex h-8 items-center overflow-hidden rounded-lg transition-colors hover:bg-accent"
			onmouseenter={(e) => handleMouseEnter(e, item.label)}
			onmousemove={handleMouseMove}
			onmouseleave={() => (hoveredLabel = null)}
		>
			<div class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-300 ease-out group-hover:bg-primary/15" style="width: {visitorsWidth}%"></div>

			{#if hasRevenue && revenueWidth > 0}
				<div class="absolute inset-y-0 left-0 bg-[#60a5fa]/15 transition-all duration-300 ease-out group-hover:bg-[#60a5fa]/25" style="width: {revenueWidth}%"></div>
			{/if}

			<div class="relative z-10 flex w-full items-center justify-between px-3">
				<div class="flex items-center gap-2 min-w-0">
					{#if item.icon}
						<img src={item.icon} alt="" class="h-3.5 w-3.5 shrink-0 rounded-sm object-contain" />
					{/if}
					<span class="truncate text-xs font-medium text-foreground">
						{#if item.label.startsWith('?')}
							<span class="opacity-50">?</span>
							{#each formatLabel(item.label) as param, i}
								{#if i > 0}<span class="opacity-50">&amp;</span>{/if}
								<span class="text-muted-foreground">{param.key}</span><span class="opacity-50">=</span><span>{param.value}</span>
							{/each}
						{:else}
							{item.label}
						{/if}
					</span>
				</div>
				<div class="flex items-center gap-2.5 shrink-0">
					{#if hasRevenue && revenue.value > 0}
						<span class="text-[10px] tabular-nums text-[#60a5fa]/70">{formatRevenue(revenue.value)}</span>
					{/if}
					<span class="text-xs tabular-nums text-muted-foreground">{formatVisitors(item.value)}</span>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	@keyframes tooltipIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(calc(-100% - 6px));
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(calc(-100% - 12px));
		}
	}
</style>
