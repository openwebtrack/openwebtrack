<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Scan } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		tabs?: string[];
		activeTab?: number;
		onTabChange?: (index: number) => void;
		onDetails?: () => void;
		count?: number | null;
		children?: Snippet;
		headerRight?: Snippet;
		class?: string;
	}

	let { tabs = [], activeTab = 0, onTabChange = () => {}, onDetails, count = null, children, headerRight, class: className = '' }: Props = $props();
</script>

<div class="flex h-[400px] max-h-[400px] min-h-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card {className}">
	<Tabs.Root value={activeTab.toString()} onValueChange={(v) => onTabChange(parseInt(v))} class="flex h-full flex-col">
		<div class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
			<Tabs.List class="no-scrollbar flex items-center gap-2 overflow-x-auto">
				{#each tabs as tab, index}
					<Tabs.Trigger
						value={index.toString()}
						class="rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border"
					>
						{tab}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
			<div class="flex items-center gap-2">
				{#if headerRight}
					{@render headerRight()}
				{/if}

				{#if onDetails}
					<button
						class="group flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
						onclick={onDetails}
						aria-label="View details"
					>
						<Scan class="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
					</button>
				{/if}
			</div>
		</div>

		<div class="relative flex-1 overflow-y-auto p-4">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Tabs.Root>
</div>
