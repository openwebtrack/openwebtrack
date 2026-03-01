<script lang="ts">
	let { items = [], revenueItems = [] } = $props();

	let maxVal = $derived(Math.max(...items.map((i: any) => i.value)));
	let maxRevenue = $derived(revenueItems.length > 0 ? Math.max(...revenueItems.map((r: any) => r.value)) : 0);

	const getRevenue = (label: string): { value: number; exists: boolean } => {
		const match = revenueItems.find((r: any) => r.label === label);
		// amounts are stored in cents → divide by 100
		return match ? { value: match.value / 100, exists: true } : { value: 0, exists: false };
	};

	const formatRevenue = (val: number): string => {
		if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
		if (val === 0) return '$0.00';
		return `$${val.toFixed(2)}`;
	};

	const formatVisitors = (val: number): string => {
		if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
		return `${val}`;
	};

	const formatLabel = (label: string): { key: string; value: string }[] => {
		if (!label.startsWith('?')) return [];
		const params = label.slice(1).split('&');
		return params.map((p) => {
			const [key, value] = p.split('=');
			return { key: key || '', value: value || '' };
		});
	};

	// Tooltip state – track mouse position for fixed-position tooltip
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

<!-- Fixed tooltip rendered via svelte:body portal to escape overflow:hidden -->
{#if hoveredLabel}
	{@const item = items.find((i: any) => i.label === hoveredLabel)}
	{#if item}
		{@const revenue = getRevenue(item.label)}
		<div
			class="pointer-events-none fixed z-[9999] w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md"
			style="left: {tooltipX}px; top: {tooltipY}px; animation: tooltipIn 0.12s ease-out both;"
		>
			<!-- header -->
			<div class="mb-2.5 flex items-center gap-1.5">
				{#if item.icon}
					<img src={item.icon} alt="" class="h-4 w-4 rounded-sm object-contain" />
				{/if}
				<span class="truncate text-xs font-semibold text-foreground">{item.label}</span>
			</div>

			<!-- metrics -->
			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<span class="inline-block h-2.5 w-2.5 rounded-sm bg-primary/70"></span>
						<span class="text-xs text-muted-foreground">Visitors</span>
					</div>
					<span class="text-xs font-semibold text-foreground">{formatVisitors(item.value)}</span>
				</div>
				{#if revenue.exists}
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-1.5">
							<span class="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/80"></span>
							<span class="text-xs text-muted-foreground">Revenue</span>
						</div>
						<span class="text-xs font-semibold text-amber-400">{formatRevenue(revenue.value)}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<div class="flex flex-col gap-2">
	{#each items as item}
		{@const revenue = getRevenue(item.label)}
		{@const hasRevenue = revenue.exists}
		{@const visitorsWidth = (item.value / maxVal) * 100}
		{@const revenueWidth = maxRevenue > 0 ? revenue.value / (maxRevenue / 100) : 0}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="group relative flex h-8 items-center overflow-hidden rounded-md"
			onmouseenter={(e) => handleMouseEnter(e, item.label)}
			onmousemove={handleMouseMove}
			onmouseleave={() => (hoveredLabel = null)}
		>
			<!-- Visitors fill -->
			<div class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500 ease-out group-hover:bg-primary/20" style="width: {visitorsWidth}%"></div>

			<!-- Revenue fill (amber, overlaid, semi-transparent) -->
			{#if hasRevenue && revenueWidth > 0}
				<div class="absolute inset-y-0 left-0 bg-amber-400/20 transition-all duration-500 ease-out group-hover:bg-amber-400/35" style="width: {revenueWidth}%"></div>
				<!-- thin amber bottom stripe -->
				<div class="absolute bottom-0 left-0 h-[3px] rounded-r-full bg-amber-400/60 transition-all duration-500 ease-out group-hover:bg-amber-400/90" style="width: {revenueWidth}%"></div>
			{/if}

			<!-- Labels -->
			<div class="relative z-10 flex w-full items-center justify-between px-3">
				<div class="flex items-center gap-2">
					{#if item.icon}
						<img src={item.icon} alt="Icon" class="h-4 w-4 rounded-sm object-contain" />
					{/if}
					<span class="truncate text-xs font-bold text-gray-900 dark:text-gray-100">
						{#if item.label.startsWith('?')}
							<span class="opacity-60">?</span>
							{#each formatLabel(item.label) as param, i}
								{#if i > 0}<span class="opacity-60">&amp;</span>{/if}
								<span class="text-muted-foreground">{param.key}</span><span class="opacity-60">=</span><span>{param.value}</span>
							{/each}
						{:else}
							{item.label}
						{/if}
					</span>
				</div>
				<div class="flex items-center gap-2">
					{#if hasRevenue && revenue.value > 0}
						<span class="text-[10px] font-medium text-amber-400/80">{formatRevenue(revenue.value)}</span>
					{/if}
					<span class="text-xs text-muted-foreground">{formatVisitors(item.value)}</span>
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
