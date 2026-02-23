<script lang="ts">
	import { X, Search, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import axios from 'axios';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let { websiteId, metricType, title, onClose } = $props();

	let searchQuery = $state('');
	let data = $state<{ label: string; value: number; icon?: string }[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(true);

	let timeout: NodeJS.Timeout;

	const fetchData = async () => {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams({
				type: metricType,
				limit: '100'
			});
			if (searchQuery) {
				params.append('search', searchQuery);
			}

			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.has('startDate')) params.append('startDate', urlParams.get('startDate')!);
			if (urlParams.has('endDate')) params.append('endDate', urlParams.get('endDate')!);
			if (urlParams.has('granularity')) params.append('granularity', urlParams.get('granularity')!);

			const response = await axios.get(`/api/websites/${websiteId}/metrics?${params.toString()}`);
			data = response.data;
		} catch (e) {
			console.error(e);
			error = 'Failed to load data';
		} finally {
			loading = false;
		}
	};

	const handleSearch = (e: Event) => {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			fetchData();
		}, 300);
	};

	onMount(() => {
		fetchData();
	});

	let maxVal = $derived(data.length > 0 ? Math.max(...data.map((i) => i.value)) : 0);

	function handleOpenChange(value: boolean) {
		open = value;
		if (!value) {
			onClose();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
		<Dialog.Close />

		<Dialog.Header class="border-b border-border pb-4">
			<div class="relative w-full max-w-xs">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="text" placeholder="Search..." value={searchQuery} oninput={handleSearch} class="pl-10" />
			</div>
		</Dialog.Header>

		<div class="-mx-6 flex-1 overflow-y-auto px-6 py-4">
			{#if loading}
				<div class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
					<Loader2 class="h-6 w-6 animate-spin" />
					<p>Loading data...</p>
				</div>
			{:else if error}
				<div class="flex h-64 flex-col items-center justify-center text-destructive">
					<p>{error}</p>
					<Button variant="secondary" onclick={fetchData} class="mt-4">Try again</Button>
				</div>
			{:else if data.length === 0}
				<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
					<p>No results found.</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each data as item}
						<div class="group relative flex h-12 items-center overflow-hidden rounded-lg border border-border bg-muted/50">
							<div class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500 ease-out" style="width: {maxVal > 0 ? (item.value / maxVal) * 100 : 0}%"></div>

							<div class="relative z-10 flex w-full items-center justify-between px-4">
								<div class="flex items-center gap-3 overflow-hidden">
									{#if item.icon}
										<img src={item.icon} alt="" class="h-5 w-5 shrink-0 rounded-sm object-contain" />
									{/if}
									<span class="truncate text-sm font-medium" title={item.label}>{item.label}</span>
								</div>
								<span class="ml-4 shrink-0 text-sm text-muted-foreground">{item.value.toLocaleString()}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
