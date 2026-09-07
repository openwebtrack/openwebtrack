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
		<!-- Header strip – mini card pattern -->
		<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
			<div class="flex items-center gap-2">
				<Tabs.List class="flex items-center gap-1">
					{#each tabs as tab, index}
						<Tabs.Trigger
							value={index.toString()}
							class="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-all duration-150 hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-sm"
						>
							{tab}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</div>
			<div class="flex items-center gap-1">
				{#if headerRight}
					{@render headerRight()}
				{/if}

				{#if onDetails}
					<button
						class="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
						onclick={onDetails}
					>
						See all
						<span class="transition-transform group-hover:translate-x-0.5">&rsaquo;</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Inner content area – grey inset -->
		<div class="relative flex-1 overflow-y-auto bg-muted/20 p-4">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Tabs.Root>
</div>
