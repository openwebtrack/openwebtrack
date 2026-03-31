<script lang="ts">
	import { getBrowserIcon, getOsIcon, getDeviceIcon, getCountryFlag, getRegionIcon, getCityIcon } from '$lib/utils/icons';
	import type { FilterType } from '$lib/components/dashboard/FilterPicker.svelte';
	import { generateAvatarUrl, generateVisitorName } from '$lib/utils/visitor';
	import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
	import { fetchExchangeRates } from '$lib/utils/currency';
	import getCountryCode from '$lib/utils/country-mapping';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import axios from 'axios';

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
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let apiData = $state<ApiData | null>(null);
	let visitors = $state<VisitorItem[]>([]);
	let events = $state<EventItem[]>([]);
	let isFetching = $state(false);
	let startDate = $state<string | null>(null);
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
		const url = new URL(window.location.href);
		const params = url.searchParams;
		if (dateRangeValue && dateRangeValue !== 'Last 7 days') {
			params.set('dateRange', dateRangeValue);
		} else {
			params.delete('dateRange');
		}
		if (granularity && granularity !== 'Daily') {
			params.set('granularity', granularity);
		} else {
			params.delete('granularity');
		}
		if (filters.length > 0) {
			params.set('filters', JSON.stringify(filters));
		} else {
			params.delete('filters');
		}
		// Use goto to update URL without adding history entry
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
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
					avatar: v.avatar || generateAvatarUrl(v.visitorId),
					name: v.name || generateVisitorName(v.visitorId),
					isCustomer: v.isCustomer || false,
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

	const handleRefresh = () => {
		fetchData();
	};

	onMount(() => {
		initFromUrl();
		fetchData();
		fetchExchangeRates('USD');
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

<Dashboard
	website={{ id: data.website.id, domain: data.website.domain, currency: (data.website as { currency?: string }).currency }}
	websites={data.websites}
	isOwner={data.isOwner}
	data={apiData}
	{visitors}
	{events}
	{isLoading}
	{error}
	showWebsiteSwitcher={true}
	onRefresh={handleRefresh}
	onDateChange={handleDateChange}
	onGranularityChange={handleGranularityChange}
	onAddFilter={handleAddFilter}
	onRemoveFilter={handleRemoveFilter}
	onClearFilters={handleClearFilters}
	{filters}
	{dateRangeValue}
	{granularity}
/>

<svelte:head>
	<title>{data.website.domain} - Dashboard</title>
</svelte:head>
