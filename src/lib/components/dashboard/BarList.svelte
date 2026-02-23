<script lang="ts">
	let { items = [] } = $props();

	let maxVal = $derived(Math.max(...items.map((i) => i.value)));
</script>

<div class="flex flex-col gap-2">
	{#each items as item}
		<div class="group relative flex h-8 items-center overflow-hidden rounded">
			<div class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500 ease-out" style="width: {(item.value / maxVal) * 100}%"></div>

			<div class="relative z-10 flex w-full items-center justify-between px-3">
				<div class="flex items-center gap-2">
					{#if item.icon}
						<img src={item.icon} alt="" class="h-4 w-4 rounded-sm object-contain" />
					{/if}
					<span class="truncate text-sm font-medium">{item.label}</span>
				</div>
				<span class="text-sm text-muted-foreground">{item.value}</span>
			</div>
		</div>
	{/each}
</div>
