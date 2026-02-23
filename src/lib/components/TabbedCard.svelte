<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { Snippet } from 'svelte';

	interface TabItem {
		id: string;
		label: string;
		content?: any;
		props?: any;
	}

	let {
		tabs = [],
		activeTab = $bindable(tabs[0]?.id),
		class: className = '',
		children,
		...rest
	} = $props<{
		tabs?: TabItem[];
		activeTab?: string;
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}>();
</script>

<Tabs.Root value={activeTab} class={className} {...rest}>
	<Tabs.List class="flex items-center border-b border-[#333] bg-[#252525]">
		{#each tabs as tab}
			<Tabs.Trigger
				value={tab.id}
				class="relative flex-1 px-4 py-3 text-center text-sm font-medium text-gray-400 transition-colors hover:bg-[#2d2d2d] hover:text-gray-200 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white sm:w-auto sm:flex-none"
			>
				{tab.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	<div class="flex-1 overflow-auto bg-[#1e1e1e] p-4">
		{#each tabs as tab}
			<Tabs.Content value={tab.id} class="h-full animate-in duration-300 fade-in slide-in-from-bottom-2">
				{#if tab.content}
					{@const Component = tab.content}
					<Component {...tab.props} />
				{:else if children}
					{@render children()}
				{/if}
			</Tabs.Content>
		{/each}
	</div>
</Tabs.Root>
