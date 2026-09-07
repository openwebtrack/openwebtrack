<script lang="ts">
	import { Monitor, Users, Link, AppWindow } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { items = [], onVisitorClick } = $props();
</script>

<div class="flex w-full flex-col text-sm">
	<div class="mb-2 flex items-center px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
		<div class="flex-1">Visitor</div>
		<div class="hidden w-48 sm:block">Source</div>
		<div class="hidden w-40 text-right sm:block">Last seen</div>
	</div>

	{#if items.length === 0}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Users class="mb-2 h-6 w-6 opacity-40" />
			<p class="text-sm">No visitors yet.</p>
		</div>
	{:else}
		<div class="flex flex-col">
			{#each items as item}
				<div onclick={() => onVisitorClick?.(item)} class="group flex cursor-pointer items-center rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
					<div class="flex flex-1 items-start gap-3 overflow-hidden">
						<img src={item.avatar} alt={item.name} class="h-8 w-8 shrink-0 rounded-full bg-secondary" />
						<div class="flex min-w-0 flex-col gap-0.5">
							<div class="flex items-center gap-2">
								<span class="truncate text-sm font-medium text-foreground transition-colors">{item.name}</span>
								{#if item.isCustomer}
									<span class="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">Customer</span>
								{/if}
							</div>
							<div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
								{#if item.country !== 'Unknown'}
									<div class="flex items-center gap-1">
										<img src={item.countryFlag} alt={item.country} class="h-auto w-3 rounded-[1px]" />
										<span>{item.country}</span>
									</div>
								{/if}
								<div class="flex items-center gap-1">
									<Monitor class="h-3 w-3" />
									<span>{item.device}</span>
								</div>
								<div class="flex items-center gap-1">
									<img src={item.osIcon} alt={item.os} class="h-3 w-3" />
									<span>{item.os}</span>
								</div>
								<div class="flex items-center gap-1">
									<img src={item.browserIcon} alt={item.browser} class="h-3 w-3" />
									<span>{item.browser}</span>
								</div>
								{#if item.isPwa}
									<div class="flex items-center gap-1 text-primary">
										<AppWindow class="h-3 w-3" />
										<span>PWA</span>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<div class="hidden w-48 items-center justify-start gap-2 sm:flex">
						{#if item.source === 'Direct'}
							<Link class="h-3.5 w-3.5 text-muted-foreground" />
						{:else}
							<img src={item.sourceIcon} alt="" class="h-3.5 w-3.5 rounded-full" />
						{/if}
						<span class="truncate text-xs text-muted-foreground">{item.source}</span>
					</div>

					<div class="hidden w-40 items-center justify-end sm:flex">
						<span class="text-xs text-muted-foreground">{item.lastSeen}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
