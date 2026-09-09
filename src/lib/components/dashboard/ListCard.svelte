<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';

	let { title, items = [], total = 0, showLink = false } = $props();

	// Calculate percentage for progress bars
	const max = $derived(Math.max(...items.map((i) => i.value)));
</script>

<div class="flex h-full flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-resting">
	<div class="flex items-center justify-between border-b border-border p-6">
		<h3 class="font-medium text-foreground">{title}</h3>
		{#if showLink}
			<button type="button" class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
				View all <ArrowUpRight class="h-3 w-3" />
			</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-0">
		<table class="w-full text-left text-sm">
			<thead class="sticky top-0 bg-muted/20 text-xs text-muted-foreground uppercase backdrop-blur-sm">
				<tr>
					<th class="px-6 py-3 font-medium">Name</th>
					<th class="w-24 px-6 py-3 text-right font-medium">Visitors</th>
					<th class="w-24 px-6 py-3 text-right font-medium">%</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					<tr class="group border-b border-border/50 bg-card transition-colors hover:bg-accent/20">
						<td class="max-w-[200px] truncate px-6 py-3 font-medium text-foreground" title={item.label}>
							<div class="flex items-center gap-2">
								{#if item.icon}
									<img src={item.icon} alt="" class="h-4 w-4 rounded-sm" />
								{/if}
								<span class="truncate">{item.label}</span>
							</div>
						</td>
						<td class="px-6 py-3 text-right text-muted-foreground">
							{item.value.toLocaleString()}
						</td>
						<td class="relative w-32 px-6 py-3 text-right">
							<div class="relative z-10 flex items-center justify-end gap-2">
								<span class="text-xs text-muted-foreground">{((item.value / total) * 100).toFixed(1)}%</span>
							</div>
							<div class="absolute inset-y-0 left-0 z-0 h-full bg-primary/10" style="width: {(item.value / max) * 100}%"></div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
