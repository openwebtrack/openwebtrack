<script lang="ts">
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	let { title = 'Metric', value = '0', change = 0, icon: Icon = null } = $props();

	const isPositive = $derived(change >= 0);
</script>

<div class="glass-card group relative overflow-hidden rounded-2xl p-4 transition-colors hover:bg-accent/30">
	<div class="flex items-start justify-between">
		<div>
			<p class="text-xs font-medium text-muted-foreground">{title}</p>
			<h3 class="mt-1 text-2xl font-medium tracking-tight tabular-nums text-foreground">{value}</h3>
		</div>
		{#if Icon}
			<div class="rounded-lg bg-muted p-2 text-muted-foreground transition-colors group-hover:text-foreground">
				<Icon class="h-4 w-4" />
			</div>
		{/if}
	</div>

	{#if change !== 0}
		<div class="mt-3 flex items-center gap-2">
			<div class={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
				{#if isPositive}
					<ArrowUp class="h-2.5 w-2.5" />
				{:else}
					<ArrowDown class="h-2.5 w-2.5" />
				{/if}
				{Math.abs(change)}%
			</div>
			<span class="text-[10px] text-muted-foreground">vs last period</span>
		</div>
	{/if}
</div>
