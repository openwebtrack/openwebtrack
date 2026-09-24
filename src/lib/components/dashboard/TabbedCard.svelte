<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Scan } from 'lucide-svelte';
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';

	interface TabItem {
		label: string;
		badge?: string;
	}

	interface Props {
		tabs?: (string | TabItem)[];
		activeTab?: number;
		onTabChange?: (index: number) => void;
		onDetails?: () => void;
		count?: number | null;
		children?: Snippet;
		headerRight?: Snippet;
		class?: string;
	}

	let { tabs = [], activeTab = 0, onTabChange = () => {}, onDetails, count = null, children, headerRight, class: className = '' }: Props = $props();

	let tabsViewport = $state<HTMLDivElement | null>(null);

	const scrollTabIntoView = (index: number, smooth = true) => {
		if (!tabsViewport) return;
		const el = tabsViewport.querySelector<HTMLElement>(`[data-tab-index="${index}"]`);
		if (!el) return;
		const { scrollLeft, clientWidth } = tabsViewport;
		const left = el.offsetLeft;
		const right = left + el.offsetWidth;
		if (left < scrollLeft) {
			tabsViewport.scrollTo({ left: left - 4, behavior: smooth ? 'smooth' : 'auto' });
		} else if (right > scrollLeft + clientWidth) {
			tabsViewport.scrollTo({ left: right - clientWidth + 4, behavior: smooth ? 'smooth' : 'auto' });
		}
	};

	const handleTabChange = (index: number) => {
		onTabChange(index);
		tick().then(() => scrollTabIntoView(index));
	};

	// Keep the active tab visible on mount (e.g. cards that start on tab index 1)
	// and whenever it changes.
	$effect(() => {
		const index = activeTab;
		tick().then(() => scrollTabIntoView(index, false));
	});
</script>

<div class="flex h-[400px] max-h-[400px] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card {className}">
	<Tabs.Root value={activeTab.toString()} onValueChange={(v) => handleTabChange(parseInt(v))} class="flex h-full min-w-0 flex-col">
		<!-- Header strip – mini card pattern. Wraps: "See all" drops to its own line when tabs need the full row. -->
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-border px-3 py-2.5 sm:px-4">
			<div bind:this={tabsViewport} class="flex min-w-fit grow items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<Tabs.List class="flex w-max items-center gap-0.5 sm:gap-1">
					{#each tabs as tab, index}
						<Tabs.Trigger
							value={index.toString()}
							data-tab-index={index}
							class="shrink-0 grow-0 basis-auto rounded-full px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-3 sm:text-xs"
						>
							{typeof tab === 'string' ? tab : tab.label}
							{#if typeof tab === 'object' && tab.badge}
								<span class="ml-1 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">{tab.badge}</span>
							{/if}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</div>
			<div class="ml-auto flex min-w-fit grow flex-wrap items-center justify-end gap-1">
				{#if headerRight}
					{@render headerRight()}
				{/if}

				{#if onDetails}
					<button
						class="group flex shrink-0 items-center gap-0.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
						onclick={onDetails}
					>
						<span class="whitespace-nowrap">See all</span>
						<span class="transition-transform group-hover:translate-x-0.5">&rsaquo;</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Inner content area – grey inset -->
		<div class="relative flex-1 overflow-y-auto bg-muted/20 p-3 sm:p-4">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Tabs.Root>
</div>
