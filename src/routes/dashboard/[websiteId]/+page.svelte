<script lang="ts">
	import { getBrowserIcon, getOsIcon, getDeviceIcon, getCountryFlag, getRegionIcon, getCityIcon } from '$lib/utils/icons';
	import { Lightbulb, RefreshCw, Settings, Search, Loader2, Users, ChevronDown, Check } from 'lucide-svelte';
	import { generateVisitorName } from '$lib/visitor-utils';
	import getCountryCode from '$lib/utils/country-mapping';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import axios from 'axios';

	import VisitorDetailsDialog from '$lib/components/dashboard/VisitorDetailsDialog.svelte';
	import MetricDetailsDialog from '$lib/components/dashboard/MetricDetailsDialog.svelte';
	import BarListCardSkeleton from '$lib/components/dashboard/BarListCardSkeleton.svelte';
	import GranularityPicker from '$lib/components/dashboard/GranularityPicker.svelte';
	import UserListSkeleton from '$lib/components/dashboard/UserListSkeleton.svelte';
	import DateRangePicker from '$lib/components/dashboard/DateRangePicker.svelte';
	import DashboardChart from '$lib/components/dashboard/DashboardChart.svelte';
	import FilterPicker from '$lib/components/dashboard/FilterPicker.svelte';
	import DonutChart from '$lib/components/dashboard/DonutChart.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import TabbedCard from '$lib/components/dashboard/TabbedCard.svelte';
	import EventList from '$lib/components/dashboard/EventList.svelte';
	import Skeleton from '$lib/components/dashboard/Skeleton.svelte';
	import UserList from '$lib/components/dashboard/UserList.svelte';
	import BarList from '$lib/components/dashboard/BarList.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	type FilterType = 'referrer' | 'campaign' | 'country' | 'region' | 'city' | 'goal' | 'hostname' | 'page' | 'entryPage' | 'browser' | 'os' | 'device' | 'pwa';

	interface Filter {
		type: FilterType;
		value: string;
	}

	interface Stats {
		visitors: number;
		pageviews: number;
		sessions: number;
		avgSessionDuration: number;
		online: number;
	}

	interface TimeSeriesPoint {
		date: string;
		visitors: number;
		pageviews: number;
	}

	interface ApiData {
		stats: Stats;
		topPages: { label: string; value: number; icon?: string }[];
		entryPages: { label: string; value: number; icon?: string }[];
		exitLinks: { label: string; value: number; icon?: string }[];
		topReferrers: { label: string; value: number; icon?: string }[];
		channelData: { label: string; value: number; icon?: string }[];
		customEvents: { type: string; name: string | null; value: number; icon?: string }[];
		deviceStats: { label: string; value: number; icon?: string }[];
		browserStats: { label: string; value: number; icon?: string }[];
		osStats: { label: string; value: number; icon?: string }[];
		deviceTypeStats: { label: string; value: number; icon?: string }[];
		countryStats: { label: string; value: number; icon?: string }[];
		regionStats: { label: string; value: number; icon?: string }[];
		cityStats: { label: string; value: number; icon?: string }[];
		timeSeries: TimeSeriesPoint[];
	}

	interface Visitor {
		visitorId: string;
		name: string | null;
		avatar: string | null;
		lastActivityAt: string;
		country: string | null;
		device: string | null;
		os: string | null;
		browser: string | null;
		referrer: string | null;
		region: string | null;
		city: string | null;
		screenWidth: number | null;
		screenHeight: number | null;
		isPwa: boolean | null;
	}

	interface VisitorItem {
		visitorId: string;
		avatar: string;
		name: string;
		countryFlag: string;
		country: string;
		device: string;
		osIcon: string;
		os: string;
		browserIcon: string;
		browser: string;
		sourceIcon: string;
		source: string;
		lastSeen: string;
		region: string | null;
		city: string | null;
		screenWidth: number | null;
		screenHeight: number | null;
		isPwa: boolean | null;
	}

	interface EventItem {
		id: number;
		type: string;
		name: string;
		data: any;
		timestamp: string;
		formattedTime: string;
		visitor: {
			id: string;
			name: string;
			avatar: string;
			country: string;
			countryFlag: string;
			city: string | null;
		};
	}

	let { data }: { data: PageData } = $props();
	let currentWebsiteId = $state<string | null>(null);
	let browserActiveTab = $state(0);
	let channelActiveTab = $state(0);
	let pageActiveTab = $state(1);
	let mapActiveTab = $state(0);
	let mainTabActive = $state(0);
	let searchQuery = $state('');

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let apiData = $state<ApiData | null>(null);
	let visitors = $state<VisitorItem[]>([]);
	let events = $state<EventItem[]>([]);
	let selectedVisitor = $state<VisitorItem | null>(null);
	let highlightEventId = $state<number | null>(null);
	let isFetching = $state(false);

	let showMetricDetails = $state(false);
	let currentMetricType = $state('');
	let currentMetricTitle = $state('');

	let startDate = $state<string | null>(null);

	const openMetricDetails = (type: string, title: string) => {
		currentMetricType = type;
		currentMetricTitle = title;
		showMetricDetails = true;
	};
	let endDate = $state<string | null>(null);
	let dateRangeValue = $state<string>('Last 7 days');
	let granularity = $state<string>('Daily');
	let filters = $state<Filter[]>([]);

	const getDateRangeFromValue = (option: string): { start: string; end: string } => {
		const now = new Date();
		const end = new Date(now);
		let start = new Date(now);

		switch (option) {
			case 'Today':
				start.setHours(0, 0, 0, 0);
				break;
			case 'Yesterday':
				start.setDate(start.getDate() - 1);
				start.setHours(0, 0, 0, 0);
				end.setDate(end.getDate() - 1);
				end.setHours(23, 59, 59, 999);
				break;
			case 'Last 24 hours':
				start.setHours(start.getHours() - 24);
				break;
			case 'Last 7 days':
				start.setDate(start.getDate() - 7);
				break;
			case 'Last 30 days':
				start.setDate(start.getDate() - 30);
				break;
			case 'Last 12 months':
				start.setMonth(start.getMonth() - 12);
				break;
			case 'Week to date':
				start.setDate(start.getDate() - start.getDay());
				start.setHours(0, 0, 0, 0);
				break;
			case 'Month to date':
				start.setDate(1);
				start.setHours(0, 0, 0, 0);
				break;
			case 'Year to date':
				start.setMonth(0, 1);
				start.setHours(0, 0, 0, 0);
				break;
			case 'All time':
				start = new Date('2020-01-01');
				break;
			default:
				start.setDate(start.getDate() - 7);
		}

		return {
			start: start.toISOString(),
			end: end.toISOString()
		};
	};

	const updateUrlParams = () => {
		const params = new URLSearchParams();
		if (dateRangeValue && dateRangeValue !== 'Last 7 days') {
			params.set('dateRange', dateRangeValue);
		}
		if (granularity && granularity !== 'Daily') {
			params.set('granularity', granularity);
		}
		if (filters.length > 0) {
			params.set('filters', JSON.stringify(filters));
		}
		const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
		window.history.replaceState({}, '', newUrl);
	};

	const initFromUrl = () => {
		const urlParams = new URLSearchParams(window.location.search);
		const dateRangeParam = urlParams.get('dateRange');
		const granularityParam = urlParams.get('granularity');
		const filtersParam = urlParams.get('filters');

		if (dateRangeParam) {
			dateRangeValue = dateRangeParam;
			const range = getDateRangeFromValue(dateRangeParam);
			startDate = range.start;
			endDate = range.end;
		} else {
			const range = getDateRangeFromValue('Last 7 days');
			startDate = range.start;
			endDate = range.end;
		}

		if (granularityParam) {
			granularity = granularityParam;
		}

		if (filtersParam) {
			try {
				filters = JSON.parse(filtersParam);
			} catch (e) {
				filters = [];
			}
		}
	};

	let stats = $derived(apiData?.stats || { visitors: 0, pageviews: 0, sessions: 0, avgSessionDuration: 0, online: 0 });
	let topPages = $derived(apiData?.topPages || []);
	let entryPages = $derived(apiData?.entryPages || []);
	let exitLinks = $derived(apiData?.exitLinks || []);
	let topReferrers = $derived(apiData?.topReferrers || []);
	let channelData = $derived(apiData?.channelData || []);
	let deviceStats = $derived(apiData?.deviceStats || []);
	let browserStats = $derived(apiData?.browserStats || []);
	let osStats = $derived(apiData?.osStats || []);
	let deviceTypeStats = $derived(apiData?.deviceTypeStats || []);
	let countryStats = $derived(apiData?.countryStats || []);
	let regionStats = $derived(apiData?.regionStats || []);
	let cityStats = $derived(apiData?.cityStats || []);
	let timeSeries = $derived(apiData?.timeSeries || []);

	let filteredVisitors = $derived(
		visitors.filter((v) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				v.name.toLowerCase().includes(q) || v.country.toLowerCase().includes(q) || v.browser.toLowerCase().includes(q) || v.os.toLowerCase().includes(q) || v.device.toLowerCase().includes(q)
			);
		})
	);

	let filteredEvents = $derived(
		events.filter((e) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.visitor.name.toLowerCase().includes(q);
		})
	);

	let hostnameData = $derived([{ label: data.website.domain, value: stats.visitors, icon: `https://icons.duckduckgo.com/ip3/${data.website.domain}.ico` }]);

	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		return isToday ? `Today at ${time}` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + time;
	};

	const getSourceDomain = (referrer: string | null) => {
		if (!referrer) return { hostname: 'Direct', domain: data.website.domain };
		try {
			const url = new URL(referrer);
			return { hostname: url.hostname, domain: url.hostname };
		} catch {
			return { hostname: 'Direct', domain: data.website.domain };
		}
	};

	const openVisitorDetails = (event: EventItem) => {
		console.log('Opening visitor details for event:', event);
		selectedVisitor = {
			visitorId: event.visitor.id,
			name: event.visitor.name,
			avatar: event.visitor.avatar,
			country: event.visitor.country,
			countryFlag: event.visitor.countryFlag,
			city: event.visitor.city,
			lastSeen: event.formattedTime,
			device: 'Unknown',
			os: 'Unknown',
			osIcon: 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a',
			browser: 'Unknown',
			browserIcon: 'https://api.iconify.design/lucide:globe.svg?color=%2371717a',
			source: 'Direct',
			sourceIcon: '',
			region: null,
			screenWidth: null,
			screenHeight: null,
			isPwa: null
		};
		highlightEventId = event.id;
	};

	const fetchData = async () => {
		if (isFetching) return;
		isFetching = true;
		const startTime = Date.now();
		if (!apiData) {
			isLoading = true;
		}
		error = null;

		const params = new URLSearchParams();
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);
		params.set('granularity', granularity.toLowerCase());
		if (filters.length > 0) {
			params.set('filters', JSON.stringify(filters));
		}

		const timestamp = Date.now().toString();
		params.set('t', timestamp);

		try {
			const [statsRes, visitorsRes, eventsRes] = await Promise.all([
				axios.get(`/api/websites/${data.website.id}/stats?${params.toString()}`),
				axios.get(`/api/websites/${data.website.id}/visitors?t=${timestamp}`),
				axios.get(`/api/websites/${data.website.id}/events?limit=50&t=${timestamp}`)
			]);
			const statsData = statsRes.data;
			apiData = {
				...statsData,
				countryStats: Array.isArray(statsData.countryStats) ? statsData.countryStats.map((s: any) => ({ ...s, icon: getCountryFlag(s.label) })) : [],
				browserStats: Array.isArray(statsData.browserStats) ? statsData.browserStats.map((s: any) => ({ ...s, icon: getBrowserIcon(s.label) })) : [],
				osStats: Array.isArray(statsData.osStats) ? statsData.osStats.map((s: any) => ({ ...s, icon: getOsIcon(s.label) })) : [],
				deviceStats: Array.isArray(statsData.deviceStats) ? statsData.deviceStats.map((s: any) => ({ ...s, icon: getDeviceIcon(s.label) })) : [],
				deviceTypeStats: Array.isArray(statsData.deviceTypeStats) ? statsData.deviceTypeStats.map((s: any) => ({ ...s, icon: getDeviceIcon(s.label) })) : [],
				regionStats: Array.isArray(statsData.regionStats) ? statsData.regionStats.map((s: any) => ({ ...s, icon: getRegionIcon() })) : [],
				cityStats: Array.isArray(statsData.cityStats) ? statsData.cityStats.map((s: any) => ({ ...s, icon: getCityIcon() })) : []
			};
			visitors = visitorsRes.data.map((v: Visitor) => {
				const countryCode = getCountryCode(v.country);
				const source = getSourceDomain(v.referrer);
				return {
					visitorId: v.visitorId,
					avatar: v.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${v.visitorId}`,
					name: v.name || generateVisitorName(v.visitorId),
					countryFlag: countryCode ? `https://flagsapi.com/${countryCode}/flat/64.png` : '',
					country: v.country || 'Unknown',
					device: v.device || 'Desktop',
					osIcon: getOsIcon(v.os),
					os: v.os || 'Unknown',
					browserIcon: getBrowserIcon(v.browser),
					browser: v.browser || 'Unknown',
					sourceIcon: `https://icons.duckduckgo.com/ip3/${source.domain}.ico`,
					source: source.hostname,
					lastSeen: formatTime(v.lastActivityAt),
					region: v.region,
					city: v.city,
					screenWidth: v.screenWidth,
					screenHeight: v.screenHeight,
					isPwa: v.isPwa
				};
			});
			events = eventsRes.data.map((e: any) => ({
				...e,
				formattedTime: formatTime(e.timestamp)
			}));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			const elapsed = Date.now() - startTime;
			if (elapsed < 500) {
				await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
			}
			isLoading = false;
			isFetching = false;
		}
	};

	const refresh = () => {
		fetchData();
	};

	const handleDateChange = (range: { start: string; end: string }, value: string) => {
		dateRangeValue = value;
		startDate = range.start;
		endDate = range.end;
		updateUrlParams();
		fetchData();
	};

	const handleGranularityChange = (g: string) => {
		granularity = g;
		updateUrlParams();
		fetchData();
	};

	const handleAddFilter = (type: FilterType, value: string) => {
		filters = [...filters, { type, value }];
		updateUrlParams();
		fetchData();
	};

	const handleRemoveFilter = (index: number) => {
		filters = filters.filter((_, i) => i !== index);
		updateUrlParams();
		fetchData();
	};

	const handleClearFilters = () => {
		filters = [];
		updateUrlParams();
		fetchData();
	};

	onMount(() => {
		initFromUrl();
		fetchData();
		const interval = setInterval(fetchData, 20000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (data.website.id && data.website.id !== currentWebsiteId) {
			currentWebsiteId = data.website.id;
			apiData = null;
			visitors = [];
			events = [];
			fetchData();
		}
	});
</script>

<div class="relative min-h-screen bg-background pb-32 selection:bg-primary/30">
	<main class="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
		<div class="glass-panel sticky top-4 z-50 mt-6 flex flex-wrap items-center gap-4 rounded-2xl border-border bg-card/60 p-2 backdrop-blur-xl">
			<Popover.Root>
				<Popover.Trigger class="group ml-1 flex cursor-pointer items-center rounded-xl border border-border bg-muted/50 px-2 py-1.5 pr-3 transition-colors hover:bg-muted">
					<img src="https://icons.duckduckgo.com/ip3/{data.website.domain}.ico" alt={data.website.domain} class="mr-2 size-4" />
					<span class="mr-2 text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground">{data.website.domain}</span>
					{#if !data.isOwner}
						<div title="Shared">
							<Users class="h-3 w-3 text-primary" />
						</div>
					{/if}
					<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
				</Popover.Trigger>
				<Popover.Content class="w-64 p-2" align="start">
					<div class="mb-2 px-2 text-xs font-medium text-muted-foreground">Switch Website</div>
					<div class="max-h-64 overflow-y-auto">
						{#each data.websites as site}
							<button
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
								onclick={() => {
									if (site.id !== data.website.id) {
										goto(`/dashboard/${site.id}`);
									}
								}}
							>
								<img src="https://icons.duckduckgo.com/ip3/{site.domain}.ico" alt={site.domain} class="size-4 shrink-0" />
								<span class="flex-1 truncate font-medium">{site.domain}</span>
								{#if !site.isOwner}
									<span class="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
										<Users class="h-2.5 w-2.5" />
										Shared
									</span>
								{/if}
								{#if site.id === data.website.id}
									<Check class="h-4 w-4 text-primary" />
								{/if}
							</button>
						{/each}
					</div>
					{#if data.isOwner}
						<div class="mt-2 border-t pt-2">
							<button
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
								onclick={() => goto(`/dashboard/${data.website.id}/settings`)}
							>
								<Settings class="h-4 w-4 text-muted-foreground" />
								<span>Website Settings</span>
							</button>
						</div>
					{/if}
				</Popover.Content>
			</Popover.Root>

			<div class="mx-2 h-6 w-px bg-border"></div>

			<DateRangePicker value={dateRangeValue} onSelect={handleDateChange} />

			<GranularityPicker value={granularity} onSelect={handleGranularityChange} />

			<div class="flex-1"></div>

			<FilterPicker
				{filters}
				websiteId={data.website.id}
				onAdd={(type, value) => handleAddFilter(type, value)}
				onRemove={(index) => handleRemoveFilter(index)}
				onClear={() => handleClearFilters()}
			/>

			<Button variant="secondary" size="icon" onclick={refresh} class="mr-1" disabled={isFetching}>
				{#if isFetching}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="h-4 w-4" />
				{/if}
			</Button>
		</div>

		{#if isLoading && !apiData}
			<div class="mb-6 animate-pulse rounded-2xl border border-border bg-card p-6 shadow-sm">
				<div class="mb-8 grid grid-cols-2 gap-6 md:grid-cols-6">
					{#each Array(2) as _}
						<div class="relative overflow-hidden rounded-xl bg-muted/50 p-4">
							<div class="mb-2 flex items-center gap-2">
								<Skeleton class="h-2 w-2 rounded-full" />
								<Skeleton class="h-3 w-16" />
							</div>
							<Skeleton class="h-7 w-12" />
						</div>
					{/each}
					<div class="relative overflow-hidden rounded-xl bg-muted/50">
						<div class="p-4">
							<div class="mb-2 flex items-center gap-2">
								<Skeleton class="h-3 w-14" />
								<Skeleton class="h-1.5 w-1.5 rounded-full" />
							</div>
							<Skeleton class="h-7 w-8" />
						</div>
					</div>
					{#each Array(2) as _}
						<div class="p-4">
							<Skeleton class="mb-2 h-3 w-16" />
							<Skeleton class="h-7 w-12" />
						</div>
					{/each}
				</div>
				<Skeleton class="h-[300px] w-full" />
			</div>

			<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div class="flex h-[339px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
					<div class="flex items-center gap-4 border-b border-border px-4 py-3">
						<Skeleton class="h-4 w-16" />
						<Skeleton class="h-4 w-16" />
					</div>
					<div class="flex flex-1 items-center justify-center p-4">
						<Skeleton class="h-48 w-48 rounded-full" />
					</div>
				</div>

				<BarListCardSkeleton />
			</div>

			<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<BarListCardSkeleton />
				<BarListCardSkeleton />
			</div>

			<div class="mb-6">
				<UserListSkeleton />
			</div>
		{:else if error && !apiData}
			<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
				<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
				<p>{error}</p>
				<button onclick={refresh} class="mt-4 rounded-lg bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"> Try again </button>
			</div>
		{:else}
			{#if error}
				<div class="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					<span>{error}</span>
					<button onclick={refresh} class="font-medium underline hover:text-destructive/80">Retry</button>
				</div>
			{/if}

			<div>
				<DashboardChart {timeSeries} {stats} granularity={granularity.toLowerCase() as 'hourly' | 'daily' | 'weekly' | 'monthly'} />
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<TabbedCard
					tabs={['Channel', 'Referrer']}
					activeTab={channelActiveTab}
					onTabChange={(i) => (channelActiveTab = i)}
					onDetails={() => {
						if (channelActiveTab === 0) openMetricDetails('channels', 'Channels');
						else if (channelActiveTab === 1) openMetricDetails('referrers', 'Referrers');
					}}
					count={stats.visitors}
					class="h-[340px]"
				>
					{#if channelActiveTab === 0}
						<div class="flex h-full w-full items-center justify-center p-8">
							<DonutChart data={channelData} />
						</div>
					{:else if channelActiveTab === 1}
						{#if topReferrers.length > 0}
							<BarList items={topReferrers} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No referrers yet.</p>
							</div>
						{/if}
					{/if}
				</TabbedCard>

				<TabbedCard
					tabs={['Hostname', 'Page', 'Entry page', 'Exit link']}
					activeTab={pageActiveTab}
					onTabChange={(i) => (pageActiveTab = i)}
					onDetails={() => {
						const types = ['hostnames', 'pages', 'entry_pages', 'exit_links'];
						const titles = ['Hostnames', 'Pages', 'Entry Pages', 'Exit Links'];
						openMetricDetails(types[pageActiveTab], titles[pageActiveTab]);
					}}
					count={stats.pageviews}
					class="h-[339px]"
				>
					{#if pageActiveTab === 0}
						<BarList items={hostnameData} />
					{:else if pageActiveTab === 1}
						{#if topPages.length > 0}
							<BarList items={topPages} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No pageviews yet.</p>
							</div>
						{/if}
					{:else if pageActiveTab === 2}
						{#if entryPages.length > 0}
							<BarList items={entryPages} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No entry pages yet.</p>
							</div>
						{/if}
					{:else if pageActiveTab === 3}
						{#if exitLinks.length > 0}
							<BarList items={exitLinks} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No exit links tracked.</p>
							</div>
						{/if}
					{/if}
				</TabbedCard>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<TabbedCard
					tabs={['Country', 'Region', 'City']}
					activeTab={mapActiveTab}
					onTabChange={(i: number) => (mapActiveTab = i)}
					onDetails={() => {
						const types = ['countries', 'regions', 'cities'];
						const titles = ['Countries', 'Regions', 'Cities'];
						openMetricDetails(types[mapActiveTab], titles[mapActiveTab]);
					}}
					count={stats.visitors}
					class="h-[339px]"
				>
					{#if mapActiveTab === 0}
						{#if countryStats.length > 0}
							<BarList items={countryStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No country data yet.</p>
							</div>
						{/if}
					{:else if mapActiveTab === 1}
						{#if regionStats.length > 0}
							<BarList items={regionStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No region data yet.</p>
							</div>
						{/if}
					{:else if mapActiveTab === 2}
						{#if cityStats.length > 0}
							<BarList items={cityStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No city data yet.</p>
							</div>
						{/if}
					{/if}
				</TabbedCard>

				<TabbedCard
					tabs={['Browser', 'OS', 'Device', 'Screen']}
					activeTab={browserActiveTab}
					onTabChange={(i: number) => (browserActiveTab = i)}
					onDetails={() => {
						const types = ['browsers', 'os', 'devices', 'screens'];
						const titles = ['Browsers', 'Operating Systems', 'Device Types', 'Screen Resolutions'];
						openMetricDetails(types[browserActiveTab], titles[browserActiveTab]);
					}}
					count={stats.visitors}
					class="h-[339px]"
				>
					{#if browserActiveTab === 0}
						{#if browserStats.length > 0}
							<BarList items={browserStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No browser data yet.</p>
							</div>
						{/if}
					{:else if browserActiveTab === 1}
						{#if osStats.length > 0}
							<BarList items={osStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No OS data yet.</p>
							</div>
						{/if}
					{:else if browserActiveTab === 2}
						{#if deviceTypeStats.length > 0}
							<BarList items={deviceTypeStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No device data yet.</p>
							</div>
						{/if}
					{:else if browserActiveTab === 3}
						{#if deviceStats.length > 0}
							<BarList items={deviceStats} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No screen data yet.</p>
							</div>
						{/if}
					{/if}
				</TabbedCard>
			</div>

			<div class="mb-6">
				{#snippet headerRight()}
					<div class="relative">
						<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input type="text" bind:value={searchQuery} placeholder="Search..." class="w-64 pl-9" />
					</div>
				{/snippet}
				<TabbedCard tabs={['Visitors', 'Events']} activeTab={mainTabActive} onTabChange={(i) => (mainTabActive = i)} {headerRight} class="min-h-[500px]">
					{#if mainTabActive === 0}
						<UserList items={filteredVisitors} onVisitorClick={(visitor: VisitorItem) => (selectedVisitor = visitor)} />
					{:else}
						<EventList items={filteredEvents} onEventClick={openVisitorDetails} />
					{/if}
				</TabbedCard>
			</div>
		{/if}
	</main>

	{#if selectedVisitor}
		<VisitorDetailsDialog
			websiteId={data.website.id}
			visitor={selectedVisitor}
			{highlightEventId}
			onClose={() => {
				selectedVisitor = null;
				highlightEventId = null;
			}}
		/>
	{/if}

	{#if showMetricDetails}
		<MetricDetailsDialog websiteId={data.website.id} metricType={currentMetricType} title={currentMetricTitle} onClose={() => (showMetricDetails = false)} />
	{/if}
</div>

<svelte:head>
	<title>{data.website.domain} - Dashboard</title>
</svelte:head>

<style>
</style>
