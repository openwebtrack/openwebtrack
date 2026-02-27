<script lang="ts">
	let { items = [], revenueItems = [] } = $props();

	let maxVal = $derived(Math.max(...items.map((i: any) => i.value)));

	const formatLabel = (label: string): { key: string; value: string }[] => {
		if (!label.startsWith('?')) return [];
		const params = label.slice(1).split('&');
		return params.map((p) => {
			const [key, value] = p.split('=');
			return { key: key || '', value: value || '' };
		});
	};
</script>

<div class="flex flex-col gap-2">
	{#each items as item}
		<div class="group group relative flex h-8 items-center overflow-hidden rounded">
			<div class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500 ease-out group-hover:bg-primary/50" style="width: {(item.value / maxVal) * 100}%"></div>

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
					<span class="text-xs text-muted-foreground">{item.value}</span>
				</div>
			</div>
		</div>
	{/each}
</div>
