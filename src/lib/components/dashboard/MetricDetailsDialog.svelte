<script lang="ts">
	import { Search, Loader2, TrendingUp, Users, DollarSign, BarChart2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import axios from 'axios';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatCurrency } from '$lib/utils/currency';

	type MetricRow = { label: string; value: number; revenue: number; customers: number; icon?: string };

	let { websiteId, metricType, title, onClose, demoData = null, websiteCurrency = 'USD' } = $props();

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

	const hasRevenue = $derived(data.some((d) => d.revenue > 0));
	const hasCustomers = $derived(data.some((d) => d.customers > 0));

	const totalVisitors = $derived(data.reduce((s, d) => s + d.value, 0));
	const totalRevenue = $derived(data.reduce((s, d) => s + (d.revenue ?? 0), 0));
	const totalCustomers = $derived(data.reduce((s, d) => s + (d.customers ?? 0), 0));

	const convRate = (customers: number, visitors: number) => (visitors > 0 ? ((customers / visitors) * 100).toFixed(1) + '%' : '—');
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
		<Dialog.Close />

		<Dialog.Header class="border-b border-border pb-4">
			<div class="flex items-center justify-between gap-4">
				<div class="relative w-full max-w-xs">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input type="text" placeholder="Search..." value={searchQuery} oninput={handleSearch} class="pl-10" />
				</div>
			</div>
		</Dialog.Header>

		<div class="-mx-6 flex-1 overflow-y-auto px-6 py-4">
			{#if loading}
				<div class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
					<Loader2 class="h-6 w-6 animate-spin" />
					<p>Loading data...</p>
				</div>
			{:else if errorMsg}
				<div class="flex h-64 flex-col items-center justify-center text-destructive">
					<p>{errorMsg}</p>
					<Button variant="secondary" onclick={fetchData} class="mt-4">Try again</Button>
				</div>
			{:else if data.length === 0}
				<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
					<p>No results found.</p>
				</div>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-xs text-muted-foreground">
							<th class="pb-2 text-left font-medium">{title}</th>
							<th class="pb-2 text-right font-medium">
								<span class="flex items-center justify-end gap-1"><Users class="h-3 w-3" /> Visitors</span>
							</th>
							<th class="pb-2 text-right font-medium">
								<span class="flex items-center justify-end gap-1"><DollarSign class="h-3 w-3" /> Revenue</span>
							</th>
							<th class="pb-2 text-right font-medium">
								<span class="flex items-center justify-end gap-1"><TrendingUp class="h-3 w-3" /> Conv. Rate</span>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data as item}
							<tr class="group transition-colors hover:bg-muted/30">
								<td class="py-2.5 pr-4">
									<div class="flex items-center gap-2 overflow-hidden">
										{#if item.icon}
											<img src={item.icon} alt="" class="h-4 w-4 shrink-0 rounded-sm object-contain" />
										{/if}
										<span class="truncate font-medium text-foreground" title={item.label}>{item.label}</span>
									</div>
								</td>
								<td class="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
									{item.value.toLocaleString()}
								</td>
								<td class="py-2.5 pr-4 text-right tabular-nums">
									<span class="text-{(item.revenue ?? 0) > 0 ? 'foreground' : 'muted-foreground'}">{formatCurrency(item.revenue ?? 0, websiteCurrency)}</span>
								</td>
								<td class="py-2.5 text-right tabular-nums">
									{#if (item.customers ?? 0) > 0}
										<span class="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
											{convRate(item.customers, item.value)}
										</span>
									{:else}
										<span class="text-muted-foreground">0.0%</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
					{#if data.length > 1}
						<tfoot>
							<tr class="border-t-2 border-border text-xs text-muted-foreground">
								<td class="pt-2.5 pr-4 font-medium">Total</td>
								<td class="pt-2.5 pr-4 text-right font-medium text-foreground tabular-nums">{totalVisitors.toLocaleString()}</td>
								<td class="pt-2.5 pr-4 text-right font-medium text-foreground tabular-nums">
									{formatCurrency(totalRevenue, websiteCurrency)}
								</td>
								<td class="pt-2.5 text-right tabular-nums">
									{#if totalCustomers > 0}
										<span class="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
											{convRate(totalCustomers, totalVisitors)}
										</span>
									{:else}
										<span class="text-muted-foreground">0.0%</span>
									{/if}
								</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
