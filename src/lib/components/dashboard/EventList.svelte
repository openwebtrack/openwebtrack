<script lang="ts">
	import { Activity } from 'lucide-svelte';

	let { items = [], onEventClick } = $props();
</script>

<div class="flex w-full flex-col text-sm">
	<div class="mb-2 flex items-center px-2 text-xs font-medium text-muted-foreground">
		<div class="flex-1">Event</div>
		<div class="hidden w-48 sm:block">Visitor</div>
		<div class="hidden w-40 text-right sm:block">Time</div>
	</div>

	{#if items.length === 0}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Activity class="mb-2 h-8 w-8 opacity-50" />
			<p>No events yet.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each items as item}
				<div
					class="group flex cursor-pointer items-center rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
					onclick={() => onEventClick?.(item)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && onEventClick?.(item)}
				>
					<div class="flex flex-1 items-start gap-3 overflow-hidden">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Activity class="h-5 w-5" />
						</div>
						<div class="flex min-w-0 flex-col gap-1">
							<span class="truncate font-medium transition-colors">{item.name}</span>
							{#if item.data}
								<div class="truncate text-xs text-muted-foreground">
									{JSON.stringify(item.data)}
								</div>
							{/if}
						</div>
					</div>

					<div class="hidden w-48 items-center justify-start gap-2 sm:flex">
						<img src={item.visitor.avatar} alt={item.visitor.name} class="h-6 w-6 rounded-full bg-muted" />
						<span class="truncate text-xs">{item.visitor.name}</span>
					</div>

					<div class="hidden w-40 items-center justify-end sm:flex">
						<span class="text-xs text-muted-foreground">{item.formattedTime}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
