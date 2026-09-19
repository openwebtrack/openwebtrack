<script lang="ts">
	import { Search, Loader2, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import axios from 'axios';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formatCurrency } from '$lib/utils/currency';

	type MetricRow = { label: string; value: number; revenue: number; customers: number; icon?: string };

	let { websiteId, metricType, title, onClose, demoData = null, websiteCurrency = 'USD', dateRange = 'Last 7 days' } = $props();

	let searchQuery = $state('');
	let data = $state<MetricRow[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let open = $state(true);

	let timeout: NodeJS.Timeout;

	const fetchData = async () => {
		loading = true;
		errorMsg = null;
		try {
			if (demoData) {
				data = demoData;
			} else {
				const params = new URLSearchParams({ type: metricType, limit: '100' });
				if (searchQuery) params.append('search', searchQuery);

				const urlParams = new URLSearchParams(window.location.search);
				if (urlParams.has('startDate')) params.append('startDate', urlParams.get('startDate')!);
				if (urlParams.has('endDate')) params.append('endDate', urlParams.get('endDate')!);
				if (urlParams.has('granularity')) params.append('granularity', urlParams.get('granularity')!);

				const response = await axios.get(`/api/websites/${websiteId}/metrics?${params.toString()}`);
				data = response.data;
			}
		} catch (e) {
			console.error(e);
			errorMsg = 'Failed to load data';
		} finally {
			loading = false;
		}
	};

	const handleSearch = (e: Event) => {
		searchQuery = (e.target as HTMLInputElement).value;
		clearTimeout(timeout);
		timeout = setTimeout(() => fetchData(), 300);
	};

	onMount(() => fetchData());

	function handleOpenChange(value: boolean) {
		open = value;
		if (!value) onClose();
	}

	const totalValue = $derived(data.reduce((s, d) => s + d.value, 0));
	const totalRevenue = $derived(data.reduce((s, d) => s + (d.revenue ?? 0), 0));
	const totalCustomers = $derived(data.reduce((s, d) => s + (d.customers ?? 0), 0));

	const getPercentage = (value: number) => {
		if (totalValue === 0) return '0%';
		return Math.round((value / totalValue) * 100) + '%';
	};

	const descriptions: Record<string, string> = {
		channels: 'Where your traffic comes from',
		referrers: 'Who sends you traffic',
		campaigns: 'Your campaign performance',
		pages: 'Your most visited pages',
		countries: 'Where your visitors are',
		browsers: 'Browser distribution',
		operatingSystems: 'Operating system breakdown',
		devices: 'Device types',
		screens: 'Screen resolutions'
	};
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[85vh] max-w-lg flex-col overflow-hidden rounded-2xl border-0 bg-background p-0 shadow-lg" showCloseButton={false}>
		<div class="flex items-start justify-between px-6 pt-6 pb-2">
			<div>
				<h2 class="text-xl font-semibold text-foreground">{title}</h2>
				<p class="mt-1 text-sm text-muted-foreground">{dateRange}</p>
			</div>
			<button onclick={() => handleOpenChange(false)} class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="px-6 pb-3">
			<p class="text-sm text-muted-foreground">
				{#if loading}
					Loading...
				{:else}
					{data.length} {data.length === 1 ? 'item' : 'items'}
					{#if totalRevenue > 0}
						· {formatCurrency(totalRevenue, websiteCurrency)} total
					{/if}
					{#if totalCustomers > 0}
						· {totalCustomers.toLocaleString()} {totalCustomers === 1 ? 'customer' : 'customers'}
					{/if}
				{/if}
			</p>
		</div>

		<div class="border-t border-border px-6 py-3">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="text" placeholder="Search..." value={searchQuery} oninput={handleSearch} class="pl-10" />
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-6 pb-6">
			{#if loading}
				<div class="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
					<Loader2 class="h-5 w-5 animate-spin" />
					<p class="text-sm">Loading...</p>
				</div>
			{:else if errorMsg}
				<div class="flex h-48 flex-col items-center justify-center text-destructive">
					<p class="text-sm">{errorMsg}</p>
				</div>
			{:else if data.length === 0}
				<div class="flex h-48 flex-col items-center justify-center text-muted-foreground">
					<p class="text-sm">No results found.</p>
				</div>
			{:else}
				<div class="flex flex-col">
					{#each data as item, i}
						<div class="group flex items-start justify-between gap-4 py-3 {i < data.length - 1 ? 'border-b border-border' : ''}">
							<div class="flex min-w-0 flex-1 items-start gap-3">
								{#if item.icon}
									<img src={item.icon} alt="" class="mt-0.5 h-4 w-4 shrink-0 rounded-sm object-contain" />
								{/if}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-foreground">{item.label}</span>
										<span class="text-xs text-muted-foreground">·</span>
										<span class="text-xs text-muted-foreground">{item.value.toLocaleString()} visitors</span>
									</div>
									{#if item.revenue > 0}
										<p class="mt-0.5 text-xs text-muted-foreground">{formatCurrency(item.revenue, websiteCurrency)} revenue</p>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-3 shrink-0">
								<span class="text-sm font-medium tabular-nums text-foreground">{getPercentage(item.value)}</span>
								{#if item.customers > 0}
									<span class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
										{((item.customers / item.value) * 100).toFixed(1)}% conv.
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
