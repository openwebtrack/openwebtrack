<script lang="ts">
	import { Lightbulb, RefreshCw, Search, Loader2, Users, ChevronDown, Check, Settings } from 'lucide-svelte';
	import { getBrowserIcon, getOsIcon, getDeviceIcon, getCountryFlag } from '$lib/utils/icons';
	import { convertCurrencySync } from '$lib/utils/currency';
	import { env } from '$env/dynamic/public';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import VisitorDetailsDialog from '$lib/components/dashboard/VisitorDetailsDialog.svelte';
	import MetricDetailsDialog from '$lib/components/dashboard/MetricDetailsDialog.svelte';
	import BarListCardSkeleton from '$lib/components/dashboard/BarListCardSkeleton.svelte';
	import GranularityPicker from '$lib/components/dashboard/GranularityPicker.svelte';
	import UserListSkeleton from '$lib/components/dashboard/UserListSkeleton.svelte';
	import type { FilterType } from '$lib/components/dashboard/FilterPicker.svelte';
	import DateRangePicker from '$lib/components/dashboard/DateRangePicker.svelte';
	import DashboardChart from '$lib/components/dashboard/DashboardChart.svelte';
	import FilterPicker from '$lib/components/dashboard/FilterPicker.svelte';
	import DonutChart from '$lib/components/dashboard/DonutChart.svelte';
	import TabbedCard from '$lib/components/dashboard/TabbedCard.svelte';
	import EventList from '$lib/components/dashboard/EventList.svelte';
	import Skeleton from '$lib/components/dashboard/Skeleton.svelte';
	import UserList from '$lib/components/dashboard/UserList.svelte';
	import BarList from '$lib/components/dashboard/BarList.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import RealTimeMap from './RealTimeMap.svelte';

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
		revenue: number;
		customers: number;
	}

	interface TimeSeriesPoint {
		date: string;
		visitors: number;
		pageviews: number;
		revenue?: number;
	}

	interface ApiData {
		stats: Stats;
		topPages: { label: string; value: number; icon?: string }[];
		entryPages: { label: string; value: number; icon?: string }[];
		exitLinks: { label: string; value: number; icon?: string }[];
		topReferrers: { label: string; value: number; icon?: string }[];
		channelData: { label: string; value: number; icon?: string }[];
		revenueByChannel: { label: string; value: number; icon?: string }[];
		campaignData: { label: string; value: number; icon?: string }[];
		customEvents: { type: string; name: string | null; value: number; icon?: string }[];
		deviceStats: { label: string; value: number; icon?: string }[];
		browserStats: { label: string; value: number; icon?: string }[];
		osStats: { label: string; value: number; icon?: string }[];
		deviceTypeStats: { label: string; value: number; icon?: string }[];
		countryStats: { label: string; value: number; icon?: string }[];
		regionStats: { label: string; value: number; icon?: string }[];
		cityStats: { label: string; value: number; icon?: string }[];
		revenueByCountry: { label: string; value: number; icon?: string }[];
		revenueByRegion: { label: string; value: number; icon?: string }[];
		revenueByCity: { label: string; value: number; icon?: string }[];
		revenueByOs: { label: string; value: number; icon?: string }[];
		revenueByBrowser: { label: string; value: number; icon?: string }[];
		revenueByDeviceType: { label: string; value: number; icon?: string }[];
		revenueByHostname: { label: string; value: number; icon?: string }[];
		revenueByPage: { label: string; value: number; icon?: string }[];
		timeSeries: TimeSeriesPoint[];
	}

	interface Visitor {
		visitorId: string;
		name: string | null;
		avatar: string | null;
		isCustomer: boolean | null;
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
		isCustomer: boolean;
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
		lastActivityAt: string;
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

	interface Website {
		id: string;
		domain: string;
		currency?: string;
	}

	interface WebsiteItem extends Website {
		isOwner?: boolean;
	}

	interface Props {
		website: Website;
		websites?: WebsiteItem[];
		isOwner?: boolean;
		data: ApiData | null;
		visitors: VisitorItem[];
		events: EventItem[];
		isLoading?: boolean;
		error?: string | null;
		showWebsiteSwitcher?: boolean;
		isDemo?: boolean;
		onRefresh?: () => void;
		onDateChange?: (range: { start: string; end: string }, value: string) => void;
		onGranularityChange?: (granularity: string) => void;
		onAddFilter?: (type: FilterType, value: string) => void;
		onRemoveFilter?: (index: number) => void;
		onClearFilters?: () => void;
		filters?: Filter[];
		dateRangeValue?: string;
		granularity?: string;
	}

	let {
		website,
		websites = [],
		isOwner = true,
		data: apiData,
		visitors,
		events,
		isLoading = false,
		error = null,
		showWebsiteSwitcher = true,
		isDemo = false,
		onRefresh,
		onDateChange,
		onGranularityChange,
		onAddFilter,
		onRemoveFilter,
		onClearFilters,
		filters = [],
		dateRangeValue = 'Last 7 days',
		granularity = 'Daily'
	}: Props = $props();

	let showGlobe = $state(false);
	let browserActiveTab = $state(0);
	let channelActiveTab = $state(0);
	let pageActiveTab = $state(1);
	let mapActiveTab = $state(0);
	let mainTabActive = $state(0);
	let searchQuery = $state('');
	let selectedVisitor = $state<VisitorItem | null>(null);
	let highlightEventId = $state<number | null>(null);
	let isFetching = $state(false);
	let showMetricDetails = $state(false);
	let currentMetricType = $state('');
	let currentMetricTitle = $state('');

	// Sync showGlobe with ?map=true query param
	let prevMapParam: string | null = null;
	$effect(() => {
		const mapParam = $page.url.searchParams.get('map');
		if (mapParam !== prevMapParam) {
			if (mapParam === 'true') {
				showGlobe = true;
			} else if (mapParam === null || mapParam === 'false') {
				showGlobe = false;
			}
			prevMapParam = mapParam;
		}
	});

	// Helper to update URL with map param
	function setMapParam(open: boolean) {
		const url = new URL($page.url);
		if (open) {
			url.searchParams.set('map', 'true');
		} else {
			url.searchParams.delete('map');
		}
		// Use replaceState to avoid adding a new history entry
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	const openRealTimeMap = () => {
		showGlobe = true;
		setMapParam(true);
	};

	const closeRealTimeMap = () => {
		showGlobe = false;
		setMapParam(false);
	};

	const openMetricDetails = (type: string, title: string) => {
		currentMetricType = type;
		currentMetricTitle = title;
		showMetricDetails = true;
	};

	let stats = $derived(apiData?.stats || { visitors: 0, pageviews: 0, sessions: 0, avgSessionDuration: 0, online: 0, revenue: 0, customers: 0 });
	let topPages = $derived(apiData?.topPages || []);
	let entryPages = $derived(apiData?.entryPages || []);
	let exitLinks = $derived(apiData?.exitLinks || []);
	let topReferrers = $derived(apiData?.topReferrers || []);
	let channelData = $derived(apiData?.channelData || []);
	let revenueByChannel = $derived(apiData?.revenueByChannel || []);
	let campaignData = $derived(apiData?.campaignData || []);
	let deviceStats = $derived(apiData?.deviceStats || []);
	let browserStats = $derived(apiData?.browserStats || []);
	let osStats = $derived(apiData?.osStats || []);
	let deviceTypeStats = $derived(apiData?.deviceTypeStats || []);
	let countryStats = $derived(apiData?.countryStats || []);
	let regionStats = $derived(apiData?.regionStats || []);
	let cityStats = $derived(apiData?.cityStats || []);
	let revenueByCountry = $derived(apiData?.revenueByCountry || []);
	let revenueByRegion = $derived(apiData?.revenueByRegion || []);
	let revenueByCity = $derived(apiData?.revenueByCity || []);
	let revenueByOs = $derived(apiData?.revenueByOs || []);
	let revenueByBrowser = $derived(apiData?.revenueByBrowser || []);
	let revenueByDeviceType = $derived(apiData?.revenueByDeviceType || []);
	let revenueByHostname = $derived(apiData?.revenueByHostname || []);
	let revenueByPage = $derived(apiData?.revenueByPage || []);
	let timeSeries = $derived(apiData?.timeSeries || []);

	let filteredVisitors = $derived(
		visitors.filter((v) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!v.name.toLowerCase().includes(q) &&
					!v.country.toLowerCase().includes(q) &&
					!v.browser.toLowerCase().includes(q) &&
					!v.os.toLowerCase().includes(q) &&
					!v.device.toLowerCase().includes(q)
				) {
					return false;
				}
			}

			for (const filter of filters) {
				if (filter.type === 'country' && !v.country.toLowerCase().includes(filter.value.toLowerCase())) return false;
				if (filter.type === 'browser' && !v.browser.toLowerCase().includes(filter.value.toLowerCase())) return false;
				if (filter.type === 'os' && !v.os.toLowerCase().includes(filter.value.toLowerCase())) return false;
				if (filter.type === 'device' && !v.device.toLowerCase().includes(filter.value.toLowerCase())) return false;
				if (filter.type === 'customer') {
					const isCustomer = filter.value.toLowerCase() === 'yes' || filter.value.toLowerCase() === 'true';
					if (v.isCustomer !== isCustomer) return false;
				}
			}

			return true;
		})
	);

	let filteredEvents = $derived(
		events.filter((e) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.visitor.name.toLowerCase().includes(q);
		})
	);

	let hostnameData = $derived([{ label: website.domain, value: stats.visitors, icon: `https://icons.duckduckgo.com/ip3/${website.domain}.ico` }]);

	let websiteCurrency = $derived(website.currency || 'USD');

	let convertedStats = $derived({
		...stats,
		revenue: convertCurrencySync(stats.revenue, 'USD', websiteCurrency)
	});

	let convertedRevenueByChannel = $derived(revenueByChannel.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByCountry = $derived(revenueByCountry.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByRegion = $derived(revenueByRegion.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByCity = $derived(revenueByCity.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByOs = $derived(revenueByOs.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByBrowser = $derived(revenueByBrowser.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByDeviceType = $derived(revenueByDeviceType.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByHostname = $derived(revenueByHostname.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));
	let convertedRevenueByPage = $derived(revenueByPage.map((item) => ({ ...item, value: convertCurrencySync(item.value, 'USD', websiteCurrency) })));

	let convertedTimeSeries = $derived(
		timeSeries.map((point) => ({
			...point,
			revenue: convertCurrencySync(point.revenue || 0, 'USD', websiteCurrency)
		}))
	);

	const refresh = () => {
		isFetching = true;
		onRefresh?.();
		setTimeout(() => {
			isFetching = false;
		}, 500);
	};

	const handleDateChange = (range: { start: string; end: string }, value: string) => {
		onDateChange?.(range, value);
	};

	const handleGranularityChange = (g: string) => {
		onGranularityChange?.(g);
	};

	const handleAddFilter = (type: string, value: string) => {
		onAddFilter?.(type, value);
	};

	const handleRemoveFilter = (index: number) => {
		onRemoveFilter?.(index);
	};

	const handleClearFilters = () => {
		onClearFilters?.();
	};

	const generateDemoVisitorDetails = (visitor: VisitorItem) => {
		const now = new Date();
		const yesterday = new Date(now.getTime() - 86400000);

		return {
			visitor: {
				id: visitor.visitorId,
				name: visitor.name,
				avatar: visitor.avatar,
				isCustomer: visitor.isCustomer,
				firstSeen: yesterday.toISOString(),
				lastSeen: now.toISOString()
			},
			journey: [
				{
					id: 1,
					startedAt: yesterday.toISOString(),
					endedAt: new Date(yesterday.getTime() + 1800000).toISOString(),
					referrer: 'https://google.com',
					utmSource: 'google',
					deviceType: visitor.device,
					os: visitor.os,
					browser: visitor.browser,
					screenWidth: visitor.screenWidth,
					screenHeight: visitor.screenHeight,
					isPwa: visitor.isPwa,
					activities: [
						{
							id: 'act-1',
							activityType: 'pageview',
							pathname: '/',
							timestamp: new Date(yesterday.getTime() + 5000).toISOString()
						},
						{
							id: 'act-2',
							activityType: 'pageview',
							pathname: '/pricing',
							timestamp: new Date(yesterday.getTime() + 60000).toISOString()
						},
						{
							id: 'act-3',
							activityType: 'event',
							name: 'Button Click',
							data: { button: 'view-plans' },
							timestamp: new Date(yesterday.getTime() + 90000).toISOString()
						},
						{
							id: 'act-4',
							activityType: 'pageview',
							pathname: '/features',
							timestamp: new Date(yesterday.getTime() + 120000).toISOString()
						}
					]
				},
				{
					id: 2,
					startedAt: now.toISOString(),
					endedAt: new Date(now.getTime() + 900000).toISOString(),
					referrer: null,
					utmSource: null,
					deviceType: visitor.device,
					os: visitor.os,
					browser: visitor.browser,
					screenWidth: visitor.screenWidth,
					screenHeight: visitor.screenHeight,
					isPwa: visitor.isPwa,
					activities: [
						{
							id: 'act-5',
							activityType: 'pageview',
							pathname: '/dashboard',
							timestamp: new Date(now.getTime() + 10000).toISOString()
						},
						{
							id: 'act-6',
							activityType: 'event',
							name: 'Feature Toggle',
							data: { feature: 'dark-mode' },
							timestamp: new Date(now.getTime() + 45000).toISOString()
						},
						{
							id: 'act-7',
							activityType: 'payment',
							amount: 2900,
							currency: 'USD',
							transactionId: 'demo_txn_' + Math.random().toString(36).substr(2, 9),
							timestamp: new Date(now.getTime() + 120000).toISOString()
						}
					]
				}
			]
		};
	};

	const generateDemoMetricData = (metricType: string): { label: string; value: number; icon?: string }[] => {
		const data: Record<string, { label: string; value: number; icon?: string }[]> = {
			channels: [
				{ label: 'Organic Search', value: 5234 },
				{ label: 'Direct', value: 3456 },
				{ label: 'Social', value: 2341 },
				{ label: 'Referral', value: 1876 },
				{ label: 'Email', value: 1234 }
			],
			referrers: [
				{ label: 'google.com', value: 5234, icon: 'https://icons.duckduckgo.com/ip3/google.com.ico' },
				{ label: 'twitter.com', value: 2341, icon: 'https://icons.duckduckgo.com/ip3/twitter.com.ico' },
				{ label: 'github.com', value: 1876, icon: 'https://icons.duckduckgo.com/ip3/github.com.ico' },
				{ label: 'linkedin.com', value: 1234, icon: 'https://icons.duckduckgo.com/ip3/linkedin.com.ico' },
				{ label: 'reddit.com', value: 876, icon: 'https://icons.duckduckgo.com/ip3/reddit.com.ico' }
			],
			campaigns: [
				{ label: 'summer_sale_2024', value: 1234 },
				{ label: 'newsletter_jan', value: 876 },
				{ label: 'black_friday', value: 654 },
				{ label: 'product_launch', value: 432 }
			],
			hostnames: [{ label: 'demo.example.com', value: 12580 }],
			pages: [
				{ label: '/', value: 12543 },
				{ label: '/pricing', value: 3421 },
				{ label: '/features', value: 2890 },
				{ label: '/about', value: 1876 },
				{ label: '/contact', value: 1234 }
			],
			entry_pages: [
				{ label: '/', value: 8923 },
				{ label: '/blog/getting-started', value: 2341 },
				{ label: '/pricing', value: 1876 },
				{ label: '/features/analytics', value: 1234 }
			],
			exit_links: [
				{ label: 'https://github.com', value: 234 },
				{ label: 'https://twitter.com', value: 187 },
				{ label: 'https://linkedin.com', value: 123 }
			],
			countries: [
				{ label: 'United States', value: 4523, icon: getCountryFlag('United States') },
				{ label: 'United Kingdom', value: 2341, icon: getCountryFlag('United Kingdom') },
				{ label: 'Germany', value: 1876, icon: getCountryFlag('Germany') },
				{ label: 'France', value: 1234, icon: getCountryFlag('France') },
				{ label: 'Canada', value: 876, icon: getCountryFlag('Canada') },
				{ label: 'Australia', value: 654, icon: getCountryFlag('Australia') }
			],
			regions: [
				{ label: 'California', value: 2341 },
				{ label: 'New York', value: 1876 },
				{ label: 'London', value: 1234 },
				{ label: 'Berlin', value: 876 },
				{ label: 'Paris', value: 654 }
			],
			cities: [
				{ label: 'San Francisco', value: 1234 },
				{ label: 'New York', value: 876 },
				{ label: 'London', value: 654 },
				{ label: 'Berlin', value: 432 },
				{ label: 'Paris', value: 321 }
			],
			browsers: [
				{ label: 'Chrome', value: 6234, icon: getBrowserIcon('Chrome') },
				{ label: 'Safari', value: 2341, icon: getBrowserIcon('Safari') },
				{ label: 'Firefox', value: 1234, icon: getBrowserIcon('Firefox') },
				{ label: 'Edge', value: 876, icon: getBrowserIcon('Edge') }
			],
			os: [
				{ label: 'Windows', value: 4523, icon: getOsIcon('Windows') },
				{ label: 'macOS', value: 3456, icon: getOsIcon('macOS') },
				{ label: 'iOS', value: 1876, icon: getOsIcon('iOS') },
				{ label: 'Android', value: 1234, icon: getOsIcon('Android') },
				{ label: 'Linux', value: 567, icon: getOsIcon('Linux') }
			],
			devices: [
				{ label: 'Desktop', value: 7890, icon: getDeviceIcon('Desktop') },
				{ label: 'Mobile', value: 3456, icon: getDeviceIcon('Mobile') },
				{ label: 'Tablet', value: 1234, icon: getDeviceIcon('Tablet') }
			],
			screens: [
				{ label: '1920x1080', value: 4523 },
				{ label: '1366x768', value: 2341 },
				{ label: '375x812', value: 1876 },
				{ label: '1440x900', value: 1234 }
			]
		};

		return (
			data[metricType] || [
				{ label: 'Demo Item 1', value: 1234 },
				{ label: 'Demo Item 2', value: 876 },
				{ label: 'Demo Item 3', value: 654 }
			]
		);
	};

	const openVisitorDetails = (event: EventItem) => {
		selectedVisitor = {
			visitorId: event.visitor.id,
			name: event.visitor.name,
			avatar: event.visitor.avatar,
			country: event.visitor.country,
			countryFlag: event.visitor.countryFlag,
			city: event.visitor.city,
			lastSeen: event.formattedTime,
			lastActivityAt: event.timestamp,
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
			isPwa: null,
			isCustomer: false
		};
		highlightEventId = event.id;
	};
</script>

<div class="relative min-h-screen bg-background pb-32 selection:bg-primary/30">
	<main class="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
		<div class="glass-panel sticky top-4 z-50 mt-6 flex flex-wrap items-center gap-4 rounded-2xl border-border bg-card/60 p-2 backdrop-blur-xl">
			{#if showWebsiteSwitcher && websites.length > 0}
				<Popover.Root>
					<Popover.Trigger class="group ml-1 flex cursor-pointer items-center rounded-xl border border-border bg-muted/50 px-2 py-1.5 pr-3 transition-colors hover:bg-muted">
						<img src="https://icons.duckduckgo.com/ip3/{website.domain}.ico" alt={website.domain} class="mr-2 size-4" />
						<span class="mr-2 text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground">{website.domain}</span>
						{#if !isOwner}
							<div title="Shared">
								<Users class="h-3 w-3 text-primary" />
							</div>
						{/if}
						<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
					</Popover.Trigger>
					<Popover.Content class="w-64 p-2" align="start">
						<div class="mb-2 px-2 text-xs font-medium text-muted-foreground">Switch Website</div>
						<div class="max-h-64 overflow-y-auto">
							{#each websites as site}
								<button
									class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
									onclick={() => {
										if (site.id !== website.id) {
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
									{#if site.id === website.id}
										<Check class="h-4 w-4 text-primary" />
									{/if}
								</button>
							{/each}
						</div>
						{#if isOwner}
							<div class="mt-2 border-t pt-2">
								<button
									class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
									onclick={() => goto(`/dashboard/${website.id}/settings`)}
								>
									<Settings class="h-4 w-4 text-muted-foreground" />
									<span>Website Settings</span>
								</button>
							</div>
						{/if}
					</Popover.Content>
				</Popover.Root>

				<div class="mx-2 h-6 w-px bg-border"></div>
			{:else}
				<div class="ml-1 flex items-center rounded-xl border border-border bg-muted/50 px-3 py-1.5">
					<img src="https://icons.duckduckgo.com/ip3/{website.domain}.ico" alt={website.domain} class="mr-2 size-4" />
					<span class="text-sm font-semibold tracking-tight">{website.domain}</span>
				</div>
				<div class="mx-2 h-6 w-px bg-border"></div>
			{/if}

			<DateRangePicker value={dateRangeValue} onSelect={handleDateChange} />

			<GranularityPicker value={granularity} onSelect={handleGranularityChange} />

			<div class="flex-1"></div>

			<Button variant="secondary" size="icon" onclick={openRealTimeMap} title="Real-time map">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10s10-4.49 10-10S17.51 2 12 2M4 12c0-.9.16-1.76.43-2.57L6 11l2 2v2l2 2l1 1v1.93c-3.94-.49-7-3.86-7-7.93m14.33 4.87c-.65-.53-1.64-.87-2.33-.87v-1c0-1.1-.9-2-2-2h-4v-3c1.1 0 2-.9 2-2V7h1c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41c0 1.83-.63 3.52-1.67 4.87"
					/></svg
				>
			</Button>

			<FilterPicker
				{filters}
				websiteId={website.id}
				{isDemo}
				{visitors}
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
			<div class="mb-6 rounded-2xl border border-border bg-card p-6">
				<div class="mb-8 grid grid-cols-2 gap-6 md:grid-cols-7">
					<div class="relative overflow-hidden rounded-xl bg-muted/50 p-4">
						<div class="mb-2 flex items-center justify-between">
							<Skeleton class="h-3 w-16" />
							<Skeleton class="h-4 w-4 rounded-full border border-blue-500" />
						</div>
						<Skeleton class="h-8 w-24" />
					</div>

					<div class="relative overflow-hidden rounded-xl bg-muted/50 p-4">
						<div class="mb-2 flex items-center justify-between">
							<Skeleton class="h-3 w-16" />
							<Skeleton class="h-4 w-4 rounded-full border border-primary" />
						</div>
						<Skeleton class="h-8 w-16" />
					</div>

					<div class="p-4">
						<div class="mb-2 flex items-center gap-2">
							<Skeleton class="h-3 w-14" />
							<Skeleton class="h-1.5 w-1.5 rounded-full" />
						</div>
						<Skeleton class="h-8 w-8" />
					</div>

					<div class="p-4">
						<Skeleton class="mb-2 h-3 w-16" />
						<Skeleton class="h-8 w-12" />
					</div>

					<div class="p-4">
						<Skeleton class="mb-2 h-3 w-20" />
						<Skeleton class="h-8 w-16" />
					</div>
				</div>
				<Skeleton class="h-[300px] w-full" />
			</div>

			<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div class="flex h-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
						<div class="flex items-center gap-2">
							<Skeleton class="h-8 w-20 rounded-lg" />
							<Skeleton class="h-8 w-20 rounded-lg" />
							<Skeleton class="h-8 w-20 rounded-lg" />
						</div>
						<Skeleton class="h-7 w-7 rounded-md" />
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
				<DashboardChart timeSeries={convertedTimeSeries} stats={convertedStats} granularity={granularity.toLowerCase() as 'hourly' | 'daily' | 'weekly' | 'monthly'} {websiteCurrency} />
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<TabbedCard
					tabs={['Channel', 'Referrer', 'Campaign']}
					activeTab={channelActiveTab}
					onTabChange={(i) => (channelActiveTab = i)}
					onDetails={() => {
						if (channelActiveTab === 0) openMetricDetails('channels', 'Channels');
						else if (channelActiveTab === 1) openMetricDetails('referrers', 'Referrers');
						else if (channelActiveTab === 2) openMetricDetails('campaigns', 'Campaigns');
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
					{:else if channelActiveTab === 2}
						{#if campaignData.length > 0}
							<BarList items={campaignData} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No campaign data yet.</p>
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
						<BarList items={hostnameData} revenueItems={convertedRevenueByHostname} {websiteCurrency} />
					{:else if pageActiveTab === 1}
						{#if topPages.length > 0}
							<BarList items={topPages} revenueItems={convertedRevenueByPage} {websiteCurrency} />
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
							<BarList items={countryStats} revenueItems={convertedRevenueByCountry} {websiteCurrency} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No country data yet.</p>
							</div>
						{/if}
					{:else if mapActiveTab === 1}
						{#if regionStats.length > 0}
							<BarList items={regionStats} revenueItems={convertedRevenueByRegion} {websiteCurrency} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No region data yet.</p>
							</div>
						{/if}
					{:else if mapActiveTab === 2}
						{#if cityStats.length > 0}
							<BarList items={cityStats} revenueItems={convertedRevenueByCity} {websiteCurrency} />
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
							<BarList items={browserStats} revenueItems={convertedRevenueByBrowser} {websiteCurrency} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No browser data yet.</p>
							</div>
						{/if}
					{:else if browserActiveTab === 1}
						{#if osStats.length > 0}
							<BarList items={osStats} revenueItems={convertedRevenueByOs} {websiteCurrency} />
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
								<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
								<p>No OS data yet.</p>
							</div>
						{/if}
					{:else if browserActiveTab === 2}
						{#if deviceTypeStats.length > 0}
							<BarList items={deviceTypeStats} revenueItems={convertedRevenueByDeviceType} {websiteCurrency} />
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
			websiteId={website.id}
			visitor={selectedVisitor}
			{highlightEventId}
			demoData={isDemo ? generateDemoVisitorDetails(selectedVisitor) : null}
			onClose={() => {
				selectedVisitor = null;
				highlightEventId = null;
			}}
		/>
	{/if}

	{#if showMetricDetails}
		<MetricDetailsDialog
			websiteId={website.id}
			metricType={currentMetricType}
			title={currentMetricTitle}
			demoData={isDemo ? generateDemoMetricData(currentMetricType) : null}
			onClose={() => (showMetricDetails = false)}
		/>
	{/if}

	{#if showGlobe}
		<RealTimeMap {visitors} {events} websiteDomain={website.domain} onlineCount={stats.online} onClose={closeRealTimeMap} />
	{/if}
</div>
