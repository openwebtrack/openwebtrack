<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';

	let { title, items = [], total = 0, showLink = false } = $props();

	// Calculate percentage for progress bars
	const max = $derived(Math.max(...items.map((i) => i.value)));
</script>

<div class="flex h-full flex-col rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
	<div class="flex items-center justify-between border-b border-zinc-100 p-6 dark:border-zinc-800">
		<h3 class="font-semibold text-zinc-900 dark:text-white">{title}</h3>
		{#if showLink}
			<button type="button" class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
				View all <ArrowUpRight class="h-3 w-3" />
			</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-0">
		<table class="w-full text-left text-sm">
			<thead class="sticky top-0 bg-zinc-50 text-xs text-zinc-500 uppercase backdrop-blur-sm dark:bg-zinc-800/50">
				<tr>
					<th class="px-6 py-3 font-medium">Name</th>
					<th class="w-24 px-6 py-3 text-right font-medium">Visitors</th>
					<th class="w-24 px-6 py-3 text-right font-medium">%</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					<tr class="group border-b border-zinc-50 bg-white transition-colors hover:bg-zinc-50 dark:border-zinc-800/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/30">
						<td class="max-w-[200px] truncate px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100" title={item.label}>
							<div class="flex items-center gap-2">
								{#if item.icon}
									<img src={item.icon} alt="" class="h-4 w-4 rounded-sm" />
								{/if}
								<span class="truncate">{item.label}</span>
							</div>
						</td>
						<td class="px-6 py-3 text-right text-zinc-600 dark:text-zinc-400">
							{item.value.toLocaleString()}
						</td>
						<td class="relative w-32 px-6 py-3 text-right">
							<div class="relative z-10 flex items-center justify-end gap-2">
								<span class="text-xs text-zinc-500 dark:text-zinc-500">{((item.value / total) * 100).toFixed(1)}%</span>
							</div>
							<div class="absolute inset-y-0 left-0 z-0 h-full bg-primary/10 dark:bg-primary/20" style="width: {(item.value / max) * 100}%"></div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
