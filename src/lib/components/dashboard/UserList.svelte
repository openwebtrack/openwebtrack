<script lang="ts">
	import { Monitor, Users, Link, AppWindow } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { items = [], onVisitorClick } = $props();
</script>

<div class="flex w-full flex-col text-sm">
	<div class="mb-2 flex items-center px-2 text-xs font-medium text-muted-foreground">
		<div class="flex-1">Visitor</div>
		<div class="hidden w-48 sm:block">Source</div>
		<div class="hidden w-40 text-right sm:block">Last seen</div>
	</div>

	{#if items.length === 0}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Users class="mb-2 h-8 w-8 opacity-50" />
			<p>No visitors yet.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each items as item}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div onclick={() => onVisitorClick?.(item)} class="group flex cursor-pointer items-center rounded-lg px-2 py-3 transition-colors hover:bg-muted/50">
					<div class="flex flex-1 items-start gap-3 overflow-hidden">
						<img src={item.avatar} alt={item.name} class="h-10 w-10 shrink-0 rounded-full bg-muted" />
						<div class="flex min-w-0 flex-col gap-1">
							<div class="flex items-center gap-2">
								<span class="truncate font-medium transition-colors">{item.name}</span>
								{#if item.isCustomer}
									<Badge class="h-5 bg-[#3b82f6] px-1.5 text-[10px] hover:bg-[#3b82f6]/90">Customer</Badge>
								{/if}
							</div>
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{#if item.country !== 'Unknown'}
									<div class="flex items-center gap-1.5">
										<img src={item.countryFlag} alt={item.country} class="h-auto w-3.5 rounded-[1px]" />
										<span>{item.country}</span>
									</div>
								{/if}
								<div class="flex items-center gap-1.5">
									<Monitor class="h-3.5 w-3.5" />
									<span>{item.device}</span>
								</div>
								<div class="flex items-center gap-1.5">
									<img src={item.osIcon} alt={item.os} class="h-3.5 w-3.5" />
									<span>{item.os}</span>
								</div>
								<div class="flex items-center gap-1.5">
									<img src={item.browserIcon} alt={item.browser} class="h-3.5 w-3.5" />
									<span>{item.browser}</span>
								</div>
								{#if item.isPwa}
									<div class="flex items-center gap-1.5 text-primary">
										<AppWindow class="h-3.5 w-3.5" />
										<span>PWA</span>
									</div>
								{/if}
							</div>
						</div>
					</div>

					<div class="hidden w-48 items-center justify-start gap-2 sm:flex">
						{#if item.source === 'Direct'}
							<Link class="h-4 w-4 text-muted-foreground" />
						{:else}
							<img src={item.sourceIcon} alt="" class="h-4 w-4 rounded-full" />
						{/if}
						<span class="truncate">{item.source}</span>
					</div>

					<div class="hidden w-40 items-center justify-end sm:flex">
						<span class="text-xs text-muted-foreground">{item.lastSeen}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
