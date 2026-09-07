<script lang="ts">
	import { Activity } from 'lucide-svelte';

	let { items = [], onEventClick } = $props();
</script>

<div class="flex w-full flex-col text-sm">
	<div class="mb-2 flex items-center px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
		<div class="flex-1">Event</div>
		<div class="hidden w-48 sm:block">Visitor</div>
		<div class="hidden w-40 text-right sm:block">Time</div>
	</div>

	{#if items.length === 0}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Activity class="mb-2 h-6 w-6 opacity-40" />
			<p class="text-sm">No events yet.</p>
		</div>
	{:else}
		<div class="flex flex-col">
			{#each items as item}
				<div
					class="group flex cursor-pointer items-center rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
					onclick={() => onEventClick?.(item)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && onEventClick?.(item)}
				>
					<div class="flex flex-1 items-start gap-3 overflow-hidden">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
							<Activity class="h-4 w-4" />
						</div>
						<div class="flex min-w-0 flex-col gap-0.5">
							<span class="truncate text-sm font-medium text-foreground transition-colors">{item.name}</span>
							{#if item.data}
								<div class="truncate text-[11px] text-muted-foreground">
									{JSON.stringify(item.data)}
								</div>
							{/if}
						</div>
					</div>

					<div class="hidden w-48 items-center justify-start gap-2 sm:flex">
						<img src={item.visitor.avatar} alt={item.visitor.name} class="h-6 w-6 rounded-full bg-secondary" />
						<span class="truncate text-xs text-muted-foreground">{item.visitor.name}</span>
					</div>

					<div class="hidden w-40 items-center justify-end sm:flex">
						<span class="text-xs text-muted-foreground">{item.formattedTime}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
