<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Filter as FilterIcon, X, Loader2, Search } from 'lucide-svelte';
	import axios from 'axios';

	type FilterType = 'referrer' | 'campaign' | 'country' | 'region' | 'city' | 'goal' | 'hostname' | 'page' | 'entryPage' | 'browser' | 'os' | 'device' | 'pwa';

	interface Filter {
		type: FilterType;
		value: string;
	}

	let {
		filters,
		onAdd,
		onRemove,
		onClear,
		websiteId
	}: {
		filters: Filter[];
		onAdd: (type: FilterType, value: string) => void;
		onRemove: (index: number) => void;
		onClear: () => void;
		websiteId: string;
	} = $props();

	let isOpen = $state(false);
	let activeFilterType = $state<FilterType | null>(null);
	let searchQuery = $state('');
	let options = $state<{ label: string; value: number }[]>([]);
	let loading = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;

	const filterTypeToMetricType: Partial<Record<FilterType, string>> = {
		country: 'countries',
		region: 'regions',
		city: 'cities',
		browser: 'browsers',
		os: 'os',
		device: 'devices',
		page: 'pages',
		hostname: 'hostnames',
		entryPage: 'entry_pages',
		referrer: 'referrers'
	};

	const resetState = () => {
		activeFilterType = null;
		searchQuery = '';
		options = [];
		loading = false;
	};

	const columns = [
		{
			title: 'SOURCE',
			items: [
				{ label: 'Referrer', type: 'referrer' as const },
				{ label: 'Campaign', type: 'campaign' as const }
			]
		},
		{
			title: 'LOCATION',
			items: [
				{ label: 'Country', type: 'country' as const },
				{ label: 'Region', type: 'region' as const },
				{ label: 'City', type: 'city' as const }
			]
		},
		{
			title: 'URL',
			items: [
				{ label: 'Hostname', type: 'hostname' as const },
				{ label: 'Page', type: 'page' as const },
				{ label: 'Entry page', type: 'entryPage' as const }
			]
		},
		{
			title: 'SYSTEM',
			items: [
				{ label: 'Browser', type: 'browser' as const },
				{ label: 'OS', type: 'os' as const },
				{ label: 'Device', type: 'device' as const },
				{ label: 'PWA', type: 'pwa' as const }
			]
		}
	];

	const fetchOptions = async (type: FilterType) => {
		const metricType = filterTypeToMetricType[type];
		if (!metricType) {
			options = [];
			return;
		}

		loading = true;
		try {
			const params = new URLSearchParams({
				type: metricType,
				limit: '50'
			});
			if (searchQuery) {
				params.append('search', searchQuery);
			}

			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.has('startDate')) params.append('startDate', urlParams.get('startDate')!);
			if (urlParams.has('endDate')) params.append('endDate', urlParams.get('endDate')!);
			if (urlParams.has('granularity')) params.append('granularity', urlParams.get('granularity')!);

			const response = await axios.get(`/api/websites/${websiteId}/metrics?${params.toString()}`);
			options = response.data;
		} catch (e) {
			console.error('Failed to fetch filter options:', e);
			options = [];
		} finally {
			loading = false;
		}
	};

	const selectFilterType = (type: FilterType) => {
		activeFilterType = type;
		searchQuery = '';
		fetchOptions(type);
	};

	const handleSearch = (e: Event) => {
		searchQuery = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			if (activeFilterType) {
				fetchOptions(activeFilterType);
			}
		}, 300);
	};

	const selectOption = (value: string) => {
		if (activeFilterType) {
			onAdd(activeFilterType, value);
			resetState();
			isOpen = false;
		}
	};

	const addCustomFilter = () => {
		if (activeFilterType && searchQuery.trim()) {
			onAdd(activeFilterType, searchQuery.trim());
			resetState();
			isOpen = false;
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addCustomFilter();
		}
	};

	const getFilterLabel = (type: FilterType): string => {
		const labels: Record<FilterType, string> = {
			referrer: 'Referrer',
			campaign: 'Campaign',
			country: 'Country',
			region: 'Region',
			city: 'City',
			goal: 'Goal',
			hostname: 'Hostname',
			page: 'Page',
			entryPage: 'Entry page',
			browser: 'Browser',
			os: 'OS',
			device: 'Device',
			pwa: 'PWA'
		};
		return labels[type] || type;
	};

	const hasOptions = (type: FilterType): boolean => {
		return type in filterTypeToMetricType;
	};

	const isBooleanFilter = (type: FilterType): boolean => {
		return type === 'pwa';
	};

	const booleanOptions: Record<'pwa', { label: string; value: string }[]> = {
		pwa: [
			{ label: 'Yes', value: 'true' },
			{ label: 'No', value: 'false' }
		]
	};

	let filteredOptions = $derived(searchQuery && !filterTypeToMetricType[activeFilterType!] ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase())) : options);
</script>

<DropdownMenu.Root bind:open={isOpen} onOpenChange={(open) => !open && resetState()}>
	<DropdownMenu.Trigger>
		<Button variant="secondary" size="icon" class="relative">
			<FilterIcon class="h-4 w-4" />
			{#if filters.length > 0}
				<span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{filters.length}</span>
			{/if}
		</Button>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-80 p-0" align="end">
		{#if activeFilterType}
			<div class="p-4">
				<div class="mb-3 flex items-center justify-between">
					<span class="text-sm font-medium">Filter by {getFilterLabel(activeFilterType)}</span>
					<Button
						variant="ghost"
						size="icon"
						class="h-6 w-6"
						onclick={() => {
							activeFilterType = null;
							searchQuery = '';
							options = [];
						}}
					>
						<X class="h-4 w-4" />
					</Button>
				</div>

				{#if hasOptions(activeFilterType)}
					<div class="relative mb-3">
						<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input type="text" value={searchQuery} oninput={handleSearch} placeholder={`Search ${getFilterLabel(activeFilterType).toLowerCase()}...`} class="pl-9" />
					</div>

					<div class="max-h-60 overflow-y-auto rounded-md border border-border">
						{#if loading}
							<div class="flex h-20 items-center justify-center text-muted-foreground">
								<Loader2 class="h-4 w-4 animate-spin" />
							</div>
						{:else if options.length === 0}
							<div class="flex h-20 items-center justify-center text-sm text-muted-foreground">
								{#if searchQuery}
									<button onclick={addCustomFilter} class="text-primary hover:underline">
										Add "{searchQuery}" as filter
									</button>
								{:else}
									No options available
								{/if}
							</div>
						{:else}
							{#each filteredOptions as option}
								<button onclick={() => selectOption(option.label)} class="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
									<span class="truncate">{option.label}</span>
									<span class="ml-2 shrink-0 text-xs text-muted-foreground">{option.value}</span>
								</button>
							{/each}
							{#if searchQuery && !options.some((o) => o.label.toLowerCase() === searchQuery.toLowerCase())}
								<button onclick={addCustomFilter} class="flex w-full items-center border-t border-border px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted">
									Add "{searchQuery}" as custom filter
								</button>
							{/if}
						{/if}
					</div>
				{:else if isBooleanFilter(activeFilterType)}
					<div class="max-h-60 overflow-y-auto rounded-md border border-border">
						{#each booleanOptions[activeFilterType as 'pwa'] as option}
							<button
								onclick={() => {
									onAdd(activeFilterType!, option.label);
									resetState();
									isOpen = false;
								}}
								class="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
							>
								<span class="truncate">{option.label}</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="space-y-3">
						<Input
							type="text"
							value={searchQuery}
							onkeydown={handleKeydown}
							oninput={(e) => (searchQuery = (e.target as HTMLInputElement).value)}
							placeholder={`Enter ${getFilterLabel(activeFilterType).toLowerCase()}...`}
							autofocus
						/>
						<Button onclick={addCustomFilter} disabled={!searchQuery.trim()} class="w-full">Add Filter</Button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-4 p-4">
				{#each [columns.slice(0, 2), columns.slice(2, 4)] as columnGroup}
					<div class="space-y-4">
						{#each columnGroup as group}
							<div>
								<h3 class="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
									{group.title}
								</h3>
								<div class="flex flex-col gap-1.5">
									{#each group.items as item}
										<button onclick={() => selectFilterType(item.type)} class="text-left text-sm transition-colors hover:text-primary">
											{item.label}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}

		{#if filters.length > 0}
			<div class="border-t bg-muted/30 p-3">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium text-muted-foreground">Active filters</span>
					<Button variant="ghost" size="sm" onclick={onClear} class="h-auto px-2 py-0 text-xs">Clear all</Button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each filters as filter, index}
						<Badge variant="secondary" class="cursor-pointer gap-1 hover:bg-destructive/10 hover:text-destructive" onclick={() => onRemove(index)}>
							<span class="opacity-70">{getFilterLabel(filter.type)}:</span>
							<span>{filter.value}</span>
							<X class="h-3 w-3" />
						</Badge>
					{/each}
				</div>
			</div>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
