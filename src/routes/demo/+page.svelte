<script lang="ts">
	import { getBrowserIcon, getOsIcon, getDeviceIcon, getCountryFlag } from '$lib/utils/icons';
	import type { FilterType } from '$lib/components/dashboard/FilterPicker.svelte';
	import { generateAvatarUrl, generateVisitorName } from '$lib/utils/visitor';
	import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
	import getCountryCode from '$lib/utils/country-mapping';

	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		return isToday ? `Today at ${time}` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + time;
	};

	// Generate realistic mock data for demo
	const generateMockData = () => {
		const countries = [
			{ name: 'United States', code: 'US' },
			{ name: 'United Kingdom', code: 'GB' },
			{ name: 'Germany', code: 'DE' },
			{ name: 'France', code: 'FR' },
			{ name: 'Canada', code: 'CA' },
			{ name: 'Australia', code: 'AU' },
			{ name: 'Japan', code: 'JP' },
			{ name: 'Brazil', code: 'BR' },
			{ name: 'India', code: 'IN' },
			{ name: 'Netherlands', code: 'NL' }
		];

		const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
		const osList = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
		const devices = ['Desktop', 'Mobile', 'Tablet'];
		const referrers = ['google.com', 'twitter.com', 'github.com', 'Direct', 'linkedin.com', 'reddit.com'];

		// Generate time series data (last 30 days)
		const timeSeries = [];
		const now = new Date();
		for (let i = 29; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			const baseVisitors = Math.floor(Math.random() * 200) + 100;
			const pageviews = Math.floor(baseVisitors * (1.5 + Math.random()));
			const hasRevenue = Math.random() > 0.6;
			timeSeries.push({
				date: date.toISOString(),
				visitors: baseVisitors,
				pageviews: pageviews,
				revenue: hasRevenue ? Math.floor(Math.random() * 2500) + 500 : 0
			});
		}

		// Generate visitors
		const visitors = [];
		for (let i = 0; i < 50; i++) {
			const country = countries[Math.floor(Math.random() * countries.length)];
			const browser = browsers[Math.floor(Math.random() * browsers.length)];
			const os = osList[Math.floor(Math.random() * osList.length)];
			const device = devices[Math.floor(Math.random() * devices.length)];
			const referrer = referrers[Math.floor(Math.random() * referrers.length)];
			const visitorId = `demo-visitor-${i}`;
			const countryCode = getCountryCode(country.name);

			visitors.push({
				visitorId: visitorId,
				avatar: generateAvatarUrl(visitorId),
				name: generateVisitorName(visitorId),
				isCustomer: Math.random() > 0.7,
				countryFlag: countryCode ? `https://flagsapi.com/${countryCode}/flat/64.png` : '',
				country: country.name,
				device: device,
				osIcon: getOsIcon(os),
				os: os,
				browserIcon: getBrowserIcon(browser),
				browser: browser,
				sourceIcon: referrer === 'Direct' ? '' : `https://icons.duckduckgo.com/ip3/${referrer}.ico`,
				source: referrer === 'Direct' ? 'Direct' : referrer,
				lastSeen: formatTime(new Date(Date.now() - Math.random() * 86400000).toISOString()),
				region: ['California', 'New York', 'London', 'Berlin', 'Paris'][Math.floor(Math.random() * 5)],
				city: ['San Francisco', 'New York', 'London', 'Berlin', 'Paris'][Math.floor(Math.random() * 5)],
				screenWidth: [1920, 1366, 1440, 375, 768][Math.floor(Math.random() * 5)],
				screenHeight: [1080, 768, 900, 812, 1024][Math.floor(Math.random() * 5)],
				isPwa: Math.random() > 0.9
			});
		}

		// Generate events
		const eventTypes = ['pageview', 'click', 'purchase', 'signup'];
		const eventNames = ['/home', '/pricing', '/features', '/about', '/contact', 'Purchase Complete', 'User Signup'];
		const events = [];
		for (let i = 0; i < 100; i++) {
			const visitor = visitors[Math.floor(Math.random() * visitors.length)];
			const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
			const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString();

			const isPurchase = eventType === 'purchase' && Math.random() > 0.85;
			events.push({
				id: i,
				type: isPurchase ? 'purchase' : eventType,
				name: isPurchase ? 'Purchase Complete' : eventNames[Math.floor(Math.random() * eventNames.length)],
				data: isPurchase ? { amount: Math.floor(Math.random() * 800) + 150 } : {},
				timestamp: timestamp,
				formattedTime: formatTime(timestamp),
				visitor: {
					id: visitor.visitorId,
					name: visitor.name,
					avatar: visitor.avatar,
					country: visitor.country,
					countryFlag: visitor.countryFlag,
					city: visitor.city
				}
			});
		}

		// Sort events by timestamp (newest first)
		events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

		// Calculate stats from time series
		const totalVisitors = timeSeries.reduce((sum, d) => sum + d.visitors, 0);
		const totalPageviews = timeSeries.reduce((sum, d) => sum + d.pageviews, 0);
		const totalRevenue = timeSeries.reduce((sum, d) => sum + (d.revenue || 0), 0);

		return {
			stats: {
				visitors: totalVisitors,
				pageviews: totalPageviews,
				sessions: Math.floor(totalVisitors * 1.2),
				avgSessionDuration: 185000,
				online: 12,
				revenue: totalRevenue,
				customers: Math.floor(totalVisitors * 0.15)
			},
			topPages: [
				{ label: '/', value: 12543 },
				{ label: '/pricing', value: 3421 },
				{ label: '/features', value: 2890 },
				{ label: '/about', value: 1876 },
				{ label: '/contact', value: 1234 }
			],
			entryPages: [
				{ label: '/', value: 8923 },
				{ label: '/blog/getting-started', value: 2341 },
				{ label: '/pricing', value: 1876 },
				{ label: '/features/analytics', value: 1234 }
			],
			exitLinks: [
				{ label: 'https://github.com', value: 234 },
				{ label: 'https://twitter.com', value: 187 },
				{ label: 'https://linkedin.com', value: 123 }
			],
			topReferrers: [
				{ label: 'google.com', value: 5234, icon: 'https://icons.duckduckgo.com/ip3/google.com.ico' },
				{ label: 'twitter.com', value: 2341, icon: 'https://icons.duckduckgo.com/ip3/twitter.com.ico' },
				{ label: 'github.com', value: 1876, icon: 'https://icons.duckduckgo.com/ip3/github.com.ico' },
				{ label: 'linkedin.com', value: 1234, icon: 'https://icons.duckduckgo.com/ip3/linkedin.com.ico' }
			],
			channelData: [
				{ label: 'Organic Search', value: 5234 },
				{ label: 'Direct', value: 3456 },
				{ label: 'Social', value: 2341 },
				{ label: 'Referral', value: 1876 },
				{ label: 'Email', value: 1234 }
			],
			revenueByChannel: [
				{ label: 'Organic Search', value: 52340 },
				{ label: 'Direct', value: 34560 },
				{ label: 'Social', value: 23410 },
				{ label: 'Referral', value: 18760 },
				{ label: 'Email', value: 12340 }
			],
			campaignData: [
				{ label: 'summer_sale_2024', value: 1234 },
				{ label: 'newsletter_jan', value: 876 }
			],
			customEvents: [
				{ type: 'purchase', name: 'Purchase Complete', value: 456 },
				{ type: 'signup', name: 'User Signup', value: 234 }
			],
			deviceStats: [
				{ label: '1920x1080', value: 4523, icon: getDeviceIcon('Desktop') },
				{ label: '1366x768', value: 2341, icon: getDeviceIcon('Desktop') },
				{ label: '375x812', value: 1876, icon: getDeviceIcon('Mobile') },
				{ label: '1440x900', value: 1234, icon: getDeviceIcon('Desktop') }
			],
			browserStats: [
				{ label: 'Chrome', value: 6234, icon: getBrowserIcon('Chrome') },
				{ label: 'Safari', value: 2341, icon: getBrowserIcon('Safari') },
				{ label: 'Firefox', value: 1234, icon: getBrowserIcon('Firefox') },
				{ label: 'Edge', value: 876, icon: getBrowserIcon('Edge') }
			],
			osStats: [
				{ label: 'Windows', value: 4523, icon: getOsIcon('Windows') },
				{ label: 'macOS', value: 3456, icon: getOsIcon('macOS') },
				{ label: 'iOS', value: 1876, icon: getOsIcon('iOS') },
				{ label: 'Android', value: 1234, icon: getOsIcon('Android') },
				{ label: 'Linux', value: 567, icon: getOsIcon('Linux') }
			],
			deviceTypeStats: [
				{ label: 'Desktop', value: 7890, icon: getDeviceIcon('Desktop') },
				{ label: 'Mobile', value: 3456, icon: getDeviceIcon('Mobile') },
				{ label: 'Tablet', value: 1234, icon: getDeviceIcon('Tablet') }
			],
			countryStats: [
				{ label: 'United States', value: 4523, icon: getCountryFlag('United States') },
				{ label: 'United Kingdom', value: 2341, icon: getCountryFlag('United Kingdom') },
				{ label: 'Germany', value: 1876, icon: getCountryFlag('Germany') },
				{ label: 'France', value: 1234, icon: getCountryFlag('France') },
				{ label: 'Canada', value: 876, icon: getCountryFlag('Canada') }
			],
			regionStats: [
				{ label: 'California', value: 2341, icon: '' },
				{ label: 'New York', value: 1876, icon: '' },
				{ label: 'London', value: 1234, icon: '' },
				{ label: 'Berlin', value: 876, icon: '' }
			],
			cityStats: [
				{ label: 'San Francisco', value: 1234, icon: '' },
				{ label: 'New York', value: 876, icon: '' },
				{ label: 'London', value: 654, icon: '' },
				{ label: 'Berlin', value: 432, icon: '' }
			],
			revenueByCountry: [
				{ label: 'United States', value: 45230, icon: getCountryFlag('United States') },
				{ label: 'United Kingdom', value: 23410, icon: getCountryFlag('United Kingdom') },
				{ label: 'Germany', value: 18760, icon: getCountryFlag('Germany') },
				{ label: 'France', value: 12340, icon: getCountryFlag('France') },
				{ label: 'Canada', value: 8760, icon: getCountryFlag('Canada') }
			],
			revenueByRegion: [
				{ label: 'California', value: 23410, icon: '' },
				{ label: 'New York', value: 18760, icon: '' },
				{ label: 'London', value: 12340, icon: '' },
				{ label: 'Berlin', value: 8760, icon: '' }
			],
			revenueByCity: [
				{ label: 'San Francisco', value: 12340, icon: '' },
				{ label: 'New York', value: 8760, icon: '' },
				{ label: 'London', value: 6540, icon: '' },
				{ label: 'Berlin', value: 4320, icon: '' }
			],
			revenueByOs: [
				{ label: 'Windows', value: 45230, icon: getOsIcon('Windows') },
				{ label: 'macOS', value: 34560, icon: getOsIcon('macOS') },
				{ label: 'iOS', value: 18760, icon: getOsIcon('iOS') },
				{ label: 'Android', value: 12340, icon: getOsIcon('Android') },
				{ label: 'Linux', value: 5670, icon: getOsIcon('Linux') }
			],
			revenueByBrowser: [
				{ label: 'Chrome', value: 62340, icon: getBrowserIcon('Chrome') },
				{ label: 'Safari', value: 23410, icon: getBrowserIcon('Safari') },
				{ label: 'Firefox', value: 12340, icon: getBrowserIcon('Firefox') },
				{ label: 'Edge', value: 8760, icon: getBrowserIcon('Edge') }
			],
			revenueByDeviceType: [
				{ label: 'Desktop', value: 78900, icon: getDeviceIcon('Desktop') },
				{ label: 'Mobile', value: 34560, icon: getDeviceIcon('Mobile') },
				{ label: 'Tablet', value: 12340, icon: getDeviceIcon('Tablet') }
			],
			revenueByHostname: [],
			revenueByPage: [],
			timeSeries,
			visitors,
			events
		};
	};

	let dateRangeValue = $state('Last 7 days');
	let granularity = $state('Daily');
	let mockData = $state(generateMockData());

	const website = {
		id: 'demo-website',
		domain: 'domain.com',
		currency: 'USD'
	};

	let filters = $state<{ type: FilterType; value: string }[]>([]);

	const regenerateData = () => {
		mockData = generateMockData();
	};

	// Filter visitors based on current filters
	const filterVisitors = (visitors: any[]) => {
		return visitors.filter((v) => {
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
		});
	};

	// Compute filtered data reactively
	let filteredData = $derived.by(() => {
		if (filters.length === 0) return mockData;

		const filteredVisitors = filterVisitors(mockData.visitors);
		const visitorIds = new Set(filteredVisitors.map((v) => v.visitorId));
		const filteredEvents = mockData.events.filter((e) => visitorIds.has(e.visitor.id));

		// Calculate filtered stats
		const visitorCount = filteredVisitors.length;
		const totalPageviews = Math.floor(visitorCount * 1.5);
		const totalRevenue = filteredEvents.filter((e) => e.type === 'purchase').reduce((sum, e) => sum + (e.data?.amount || 0), 0);

		return {
			...mockData,
			stats: {
				...mockData.stats,
				visitors: visitorCount,
				pageviews: totalPageviews,
				sessions: Math.floor(visitorCount * 1.2),
				revenue: totalRevenue,
				customers: filteredVisitors.filter((v) => v.isCustomer).length
			},
			visitors: filteredVisitors,
			events: filteredEvents
		};
	});

	const handleAddFilter = (type: FilterType, value: string) => {
		filters = [...filters, { type, value }];
	};

	const handleRemoveFilter = (index: number) => {
		filters = filters.filter((_, i) => i !== index);
	};

	const handleClearFilters = () => {
		filters = [];
	};
</script>

<Dashboard
	{website}
	data={filteredData}
	visitors={filteredData.visitors}
	events={filteredData.events}
	showWebsiteSwitcher={false}
	isDemo={true}
	{filters}
	{dateRangeValue}
	{granularity}
	onRefresh={() => {
		regenerateData();
	}}
	onDateChange={(range, value) => {
		dateRangeValue = value;
		regenerateData();
	}}
	onGranularityChange={(g) => {
		granularity = g;
		regenerateData();
	}}
	onAddFilter={handleAddFilter}
	onRemoveFilter={handleRemoveFilter}
	onClearFilters={handleClearFilters}
/>

<svelte:head>
	<title>Demo Dashboard - OpenWebTrack</title>
	<meta name="description" content="Demo dashboard showing OpenWebTrack analytics capabilities" />
</svelte:head>
