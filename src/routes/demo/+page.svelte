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
			{ name: 'Netherlands', code: 'NL' },
			{ name: 'Romania', code: 'RO' }
		];

		const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
		const osList = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
		const devices = ['Desktop', 'Mobile', 'Tablet'];
		const referrers = ['google.com', 'twitter.com', 'github.com', 'Direct', 'linkedin.com', 'reddit.com'];

		// Realistic city/region mappings by country
		const locationByCountry: Record<string, { region: string; city: string }[]> = {
			US: [
				{ region: 'California', city: 'San Francisco' },
				{ region: 'California', city: 'Los Angeles' },
				{ region: 'New York', city: 'New York City' },
				{ region: 'Texas', city: 'Austin' },
				{ region: 'Washington', city: 'Seattle' },
				{ region: 'Illinois', city: 'Chicago' },
				{ region: 'Florida', city: 'Miami' }
			],
			GB: [
				{ region: 'England', city: 'London' },
				{ region: 'England', city: 'Manchester' },
				{ region: 'England', city: 'Birmingham' },
				{ region: 'Scotland', city: 'Edinburgh' },
				{ region: 'England', city: 'Bristol' }
			],
			DE: [
				{ region: 'Berlin', city: 'Berlin' },
				{ region: 'Bavaria', city: 'Munich' },
				{ region: 'Hamburg', city: 'Hamburg' },
				{ region: 'Hesse', city: 'Frankfurt' },
				{ region: 'North Rhine-Westphalia', city: 'Cologne' }
			],
			FR: [
				{ region: 'Île-de-France', city: 'Paris' },
				{ region: "Provence-Alpes-Côte d'Azur", city: 'Marseille' },
				{ region: 'Auvergne-Rhône-Alpes', city: 'Lyon' },
				{ region: 'Nouvelle-Aquitaine', city: 'Bordeaux' }
			],
			CA: [
				{ region: 'Ontario', city: 'Toronto' },
				{ region: 'British Columbia', city: 'Vancouver' },
				{ region: 'Quebec', city: 'Montreal' },
				{ region: 'Alberta', city: 'Calgary' }
			],
			AU: [
				{ region: 'New South Wales', city: 'Sydney' },
				{ region: 'Victoria', city: 'Melbourne' },
				{ region: 'Queensland', city: 'Brisbane' },
				{ region: 'Western Australia', city: 'Perth' }
			],
			JP: [
				{ region: 'Kantō', city: 'Tokyo' },
				{ region: 'Kansai', city: 'Osaka' },
				{ region: 'Chūbu', city: 'Nagoya' },
				{ region: 'Kyushu', city: 'Fukuoka' }
			],
			BR: [
				{ region: 'São Paulo', city: 'São Paulo' },
				{ region: 'Rio de Janeiro', city: 'Rio de Janeiro' },
				{ region: 'Minas Gerais', city: 'Belo Horizonte' },
				{ region: 'Bahia', city: 'Salvador' }
			],
			IN: [
				{ region: 'Maharashtra', city: 'Mumbai' },
				{ region: 'Karnataka', city: 'Bangalore' },
				{ region: 'Delhi', city: 'New Delhi' },
				{ region: 'Tamil Nadu', city: 'Chennai' },
				{ region: 'Telangana', city: 'Hyderabad' }
			],
			NL: [
				{ region: 'North Holland', city: 'Amsterdam' },
				{ region: 'South Holland', city: 'Rotterdam' },
				{ region: 'South Holland', city: 'The Hague' },
				{ region: 'Utrecht', city: 'Utrecht' }
			],
			RO: [
				{ region: 'Bucharest', city: 'Bucharest' },
				{ region: 'Cluj', city: 'Cluj-Napoca' },
				{ region: 'Timiș', city: 'Timișoara' },
				{ region: 'Iași', city: 'Iași' },
				{ region: 'Constanța', city: 'Constanța' },
				{ region: 'Craiova', city: 'Craiova' },
				{ region: 'Brașov', city: 'Brașov' }
			]
		};

		// Generate time series data (last 30 days)
		const timeSeries = [];
		const now = new Date();
		for (let i = 29; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			const baseVisitors = Math.floor(Math.random() * 200) + 100;
			const pageviews = Math.floor(baseVisitors * (1.5 + Math.random()));
			const hasRevenue = Math.random() > 0.6;
			const customers = Math.floor(baseVisitors * (Math.random() * 0.1 + 0.05));
			timeSeries.push({
				date: date.toISOString(),
				visitors: baseVisitors,
				pageviews: pageviews,
				customers: customers,
				conversionRate: (customers / baseVisitors) * 100,
				revenue: hasRevenue ? Math.floor(Math.random() * 2500) + 500 : 0
			});
		}

		// Generate visitors
		const visitors = [];
		for (let i = 0; i < 30; i++) {
			const country = countries[Math.floor(Math.random() * countries.length)];
			const browser = browsers[Math.floor(Math.random() * browsers.length)];
			const os = osList[Math.floor(Math.random() * osList.length)];
			const device = devices[Math.floor(Math.random() * devices.length)];
			const referrer = referrers[Math.floor(Math.random() * referrers.length)];
			const visitorId = `demo-visitor-${i}`;
			const countryCode = getCountryCode(country.name);
			// First 20 visitors are online (within last 5 min), others are not
			const isOnline = i < 20;
			const lastActivityAt = isOnline ? new Date(Date.now() - Math.random() * 5 * 60 * 1000).toISOString() : new Date(Date.now() - (5 * 60 * 1000 + Math.random() * 86400000)).toISOString();

			const locations = locationByCountry[country.code] || [{ region: '', city: '' }];
			const location = locations[Math.floor(Math.random() * locations.length)];

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
				lastSeen: formatTime(lastActivityAt),
				lastActivityAt: lastActivityAt,
				region: location.region,
				city: location.city,
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

		// Generate region and city stats from visitors
		const regionCounts: Record<string, number> = {};
		const cityCounts: Record<string, number> = {};
		for (const v of visitors) {
			if (v.region) regionCounts[v.region] = (regionCounts[v.region] || 0) + Math.floor(Math.random() * 500) + 100;
			if (v.city) cityCounts[v.city] = (cityCounts[v.city] || 0) + Math.floor(Math.random() * 300) + 50;
		}
		const regionStats = Object.entries(regionCounts)
			.map(([label, value]) => ({ label, value, icon: '' }))
			.sort((a, b) => b.value - a.value);
		const cityStats = Object.entries(cityCounts)
			.map(([label, value]) => ({ label, value, icon: '' }))
			.sort((a, b) => b.value - a.value);

		return {
			stats: {
				visitors: totalVisitors,
				pageviews: totalPageviews,
				sessions: Math.floor(totalVisitors * 1.2),
				avgSessionDuration: 185000,
				online: visitors.filter((v) => {
					const lastActivity = new Date(v.lastActivityAt).getTime();
					return Date.now() - lastActivity <= 5 * 60 * 1000;
				}).length,
				revenue: totalRevenue,
				revenuePerVisitor: totalVisitors > 0 ? totalRevenue / totalVisitors : 0,
				conversionRate: totalVisitors > 0 ? (Math.floor(totalVisitors * 0.15) / totalVisitors) * 100 : 0,
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
			customersByChannel: [
				{ label: 'Organic Search', value: 452 },
				{ label: 'Direct', value: 321 },
				{ label: 'Social', value: 198 },
				{ label: 'Referral', value: 154 },
				{ label: 'Email', value: 92 }
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
			customersByBrowser: [
				{ label: 'Chrome', value: 452 },
				{ label: 'Safari', value: 2341 },
				{ label: 'Firefox', value: 123 },
				{ label: 'Edge', value: 87 }
			],
			osStats: [
				{ label: 'Windows', value: 4523, icon: getOsIcon('Windows') },
				{ label: 'macOS', value: 3456, icon: getOsIcon('macOS') },
				{ label: 'iOS', value: 1876, icon: getOsIcon('iOS') },
				{ label: 'Android', value: 1234, icon: getOsIcon('Android') },
				{ label: 'Linux', value: 567, icon: getOsIcon('Linux') }
			],
			customersByOs: [
				{ label: 'Windows', value: 452 },
				{ label: 'macOS', value: 345 },
				{ label: 'iOS', value: 187 },
				{ label: 'Android', value: 123 },
				{ label: 'Linux', value: 56 }
			],
			deviceTypeStats: [
				{ label: 'Desktop', value: 7890, icon: getDeviceIcon('Desktop') },
				{ label: 'Mobile', value: 3456, icon: getDeviceIcon('Mobile') },
				{ label: 'Tablet', value: 1234, icon: getDeviceIcon('Tablet') }
			],
			customersByDeviceType: [
				{ label: 'Desktop', value: 789 },
				{ label: 'Mobile', value: 345 },
				{ label: 'Tablet', value: 123 }
			],
			countryStats: [
				{ label: 'United States', value: 4523, icon: getCountryFlag('United States') },
				{ label: 'United Kingdom', value: 2341, icon: getCountryFlag('United Kingdom') },
				{ label: 'Germany', value: 1876, icon: getCountryFlag('Germany') },
				{ label: 'France', value: 1234, icon: getCountryFlag('France') },
				{ label: 'Canada', value: 876, icon: getCountryFlag('Canada') }
			],
			customersByCountry: [
				{ label: 'United States', value: 452 },
				{ label: 'United Kingdom', value: 234 },
				{ label: 'Germany', value: 187 },
				{ label: 'France', value: 123 },
				{ label: 'Canada', value: 87 }
			],
			regionStats,
			cityStats,
			customersByRegion: regionStats.map((r) => ({ ...r, value: Math.floor(r.value / 10) })),
			customersByCity: cityStats.map((c) => ({ ...c, value: Math.floor(c.value / 10) })),
			revenueByCountry: [
				{ label: 'United States', value: 45230, icon: getCountryFlag('United States') },
				{ label: 'United Kingdom', value: 23410, icon: getCountryFlag('United Kingdom') },
				{ label: 'Germany', value: 18760, icon: getCountryFlag('Germany') },
				{ label: 'France', value: 12340, icon: getCountryFlag('France') },
				{ label: 'Canada', value: 8760, icon: getCountryFlag('Canada') }
			],
			revenueByRegion: regionStats.map((r) => ({ ...r, value: r.value * 10 })),
			revenueByCity: cityStats.map((c) => ({ ...c, value: c.value * 10 })),
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
			customersByHostname: [],
			customersByPage: [],
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
				revenuePerVisitor: visitorCount > 0 ? totalRevenue / visitorCount : 0,
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
