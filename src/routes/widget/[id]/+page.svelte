<script lang="ts">
	import Logo from '@/components/Logo.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	let { data } = $props();

	let website = $derived(data.website);
	let visitors = $state<any[]>([]);
	let loading = $state(true);

	// Theme and visibility options from query params
	let showGraph = $derived(page.url.searchParams.get('graph') !== 'false');
	let showCountries = $derived(page.url.searchParams.get('countries') !== 'false');
	let primaryColor = $derived(page.url.searchParams.get('primary') || '#f97316'); // default orange-500
	let bgColor = $derived(page.url.searchParams.get('bg') || '#09090b'); // default zinc-950

	// Calculate counts
	let now = $state(Date.now());
	let thirtyMinutes = 30 * 60 * 1000;

	let last30MinVisitors = $derived(
		visitors.filter((v) => {
			const lastSeen = new Date(v.lastActivityAt).getTime();
			return now - lastSeen <= thirtyMinutes;
		})
	);

	// Country breakdown for last 30 mins
	let countryStats = $derived.by(() => {
		const stats: Record<string, number> = {};
		last30MinVisitors.forEach((v) => {
			if (v.country) {
				stats[v.country] = (stats[v.country] || 0) + 1;
			}
		});
		return Object.entries(stats)
			.map(([label, value]) => ({ label, value }))
			.sort((a, b) => b.value - a.value)
			.slice(0, 5);
	});

	// Simple graph data (visitors per minute for last 30 minutes)
	let graphData = $derived.by(() => {
		const minutes = Array(31).fill(0);
		last30MinVisitors.forEach((v) => {
			const lastSeen = new Date(v.lastActivityAt).getTime();
			const minAgo = Math.floor((now - lastSeen) / 60000);
			if (minAgo >= 0 && minAgo <= 30) {
				minutes[30 - minAgo]++;
			}
		});
		return minutes;
	});

	async function fetchVisitors() {
		try {
			// Add isWidget parameter to bypass authentication for public widgets
			const res = await fetch(`/api/websites/${website.id}/visitors?isWidget=true`);
			if (res.ok) {
				visitors = await res.json();
			}
		} catch (e) {
			console.error('Failed to fetch visitors', e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchVisitors();
		const interval = setInterval(() => {
			now = Date.now();
			fetchVisitors();
		}, 30000);
		return () => clearInterval(interval);
	});
</script>

<div
	class="mx-auto flex h-full w-full max-w-xs flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors duration-300"
	style="background-color: {bgColor}; color: #ffffff; border-color: rgba(255,255,255,0.1);"
>
	<div class="mb-4">
		<h2 class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Users in last 30 minutes</h2>
		<div class="mt-1 flex items-center gap-2">
			<span class="text-3xl font-bold">{last30MinVisitors.length}</span>
			<span class="relative flex h-2 w-2">
				<span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style="background-color: {primaryColor};"></span>
				<span class="relative inline-flex h-2 w-2 rounded-full" style="background-color: {primaryColor};"></span>
			</span>
		</div>
	</div>

	{#if showGraph}
		<div class="mb-6 flex h-24 items-end gap-[2px]">
			{#each graphData as count, i}
				{@const height = Math.max((count / Math.max(...graphData, 1)) * 100, 4)}
				<div class="w-full rounded-t-sm transition-all hover:opacity-100" style="height: {height}%; background-color: {primaryColor}; opacity: 0.8;" title="{30 - i}m ago: {count} users"></div>
			{/each}
		</div>
	{/if}

	{#if showCountries && countryStats.length > 0}
		<div class="space-y-2">
			<h3 class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Country</h3>
			<div class="space-y-1.5">
				{#each countryStats as { label, value }}
					<div class="flex items-center justify-between text-xs">
						<div class="flex items-center gap-2">
							<span class="w-4 text-[10px] font-medium text-zinc-500">{label.slice(0, 2).toUpperCase()}</span>
							<span class="truncate font-medium">{label}</span>
						</div>
						<span class="font-bold">{value}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mt-auto pt-4 text-[10px] text-zinc-500">
		<div class="flex items-center justify-between">
			<span class="font-medium">Powered by</span>
			<a href="https://openwebtrack.github.io/" target="_blank" class="flex items-center gap-1.5 transition-opacity hover:opacity-80">
				<Logo class="h-4 w-4" />
				<span class="font-bold tracking-tight text-white">OpenWebTrack</span>
			</a>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: transparent;
	}
</style>
