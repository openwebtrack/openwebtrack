<script lang="ts">
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	let { title = 'Metric', value = '0', change = 0, icon: Icon = null } = $props();

	const isPositive = $derived(change >= 0);
</script>

<div class="glass-card group relative overflow-hidden rounded-2xl p-6">
	<!-- Ambient Background Glow -->
	<div class="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:bg-primary/20"></div>

	<div class="relative z-10 flex items-start justify-between">
		<div>
			<p class="text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-300">{title}</p>
			<h3 class="mt-2 text-3xl font-bold tracking-tight text-white">{value}</h3>
		</div>
		{#if Icon}
			<div class="rounded-xl bg-white/5 p-3 text-zinc-400 ring-1 ring-white/10 transition-colors group-hover:text-white group-hover:ring-primary/30">
				<Icon class="h-5 w-5" />
			</div>
		{/if}
	</div>

	<div class="relative z-10 mt-4 flex items-center">
		{#if change !== 0}
			<div
				class={`flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${isPositive ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-400 ring-rose-500/20'}`}
			>
				{#if isPositive}
					<ArrowUp class="mr-1 h-3 w-3" />
				{:else}
					<ArrowDown class="mr-1 h-3 w-3" />
				{/if}
				{Math.abs(change)}%
			</div>
			<span class="ml-2 text-xs text-zinc-500">vs last period</span>
		{/if}
	</div>
</div>
