<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { ArrowUpRight } from 'lucide-svelte';
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

<div class="flex h-full min-h-[339px] flex-col overflow-hidden rounded-2xl border border-border bg-card {className}">
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
			{#if headerRight}
				{@render headerRight()}
			{/if}
		</div>

		<div class="relative flex-1 overflow-y-auto p-4">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</Tabs.Root>

	{#if onDetails}
		<div
			class="group flex cursor-pointer items-center justify-center border-t border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
			onclick={onDetails}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onDetails?.()}
			role="button"
			tabindex="0"
		>
			<button class="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase transition-colors group-hover:text-primary" tabindex="-1">
				<span>Details</span>
				<ArrowUpRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
			</button>
		</div>
	{/if}
</div>
