import { analyticsSession, pageview, visitor, analyticsEvent, website, payment } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { importSchema } from '$lib/server/validation';
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import db from '$lib/server/db';
import axios from 'axios';

interface UmamiEvent {
	website_id: string;
	session_id: string;
	visit_id: string;
	event_id: string;
	hostname: string;
	browser: string;
	os: string;
	device: string;
	screen: string;
	language: string;
	country: string;
	region: string;
	city: string;
	url_path: string;
	url_query: string;
	utm_source: string;
	utm_medium: string;
	utm_campaign: string;
	utm_content: string;
	utm_term: string;
	referrer_path: string;
	referrer_query: string;
	referrer_domain: string;
	page_title: string;
	event_type: number;
	event_name: string;
	tag: string;
	created_at: string;
}

interface PlausibleVisitors {
	date: string;
	visitors: string;
	pageviews: string;
	bounces: string;
	visits: string;
	visit_duration: string;
}

interface PlausiblePages {
	date: string;
	hostname: string;
	page: string;
	visits: string;
	visitors: string;
	pageviews: string;
}

interface PlausibleBrowsers {
	date: string;
	browser: string;
	browser_version: string;
	visitors: string;
	visits: string;
}

interface PlausibleDevices {
	date: string;
	device: string;
	visitors: string;
	visits: string;
}

interface PlausibleOS {
	date: string;
	operating_system: string;
	operating_system_version: string;
	visitors: string;
	visits: string;
}

interface PlausibleLocations {
	date: string;
	country: string;
	region: string;
	city: string;
	visitors: string;
	visits: string;
}

interface PlausibleSources {
	date: string;
	source: string;
	referrer: string;
	utm_source: string;
	utm_medium: string;
	utm_campaign: string;
	utm_content: string;
	utm_term: string;
	pageviews: string;
	visitors: string;
	visits: string;
}

interface PlausibleEvents {
	date: string;
	name: string;
	link_url: string;
	path: string;
	visitors: string;
	events: string;
}

interface ImportResult {
	sessionsCreated: number;
	pageviewsCreated: number;
	eventsCreated: number;
	skippedRows: number;
}

interface DataFastOverview {
	visitors: number;
	sessions: number;
	bounce_rate: number;
	avg_session_duration: number;
	revenue: number;
	conversion_rate: number;
}

interface DataFastTimeSeries {
	timestamp: string;
	visitors: number;
	sessions: number;
	revenue?: number;
}

interface DataFastPages {
	hostname: string;
	path: string;
	visitors: number;
	revenue: number;
}

interface DataFastReferrers {
	referrer: string;
	visitors: number;
	revenue: number;
}

interface DataFastDevices {
	device: string;
	visitors: number;
	revenue: number;
}

interface DataFastBrowsers {
	browser: string;
	visitors: number;
	revenue: number;
}

interface DataFastCountries {
	country: string;
	visitors: number;
	revenue: number;
}

const DATAFAST_API_BASE = 'https://datafa.st/api/v1';

const fetchDataFast = async (endpoint: string, apiKey: string, params: Record<string, string> = {}) => {
	const url = new URL(`${DATAFAST_API_BASE}${endpoint}`);
	Object.entries(params).forEach(([key, value]) => {
		if (value) url.searchParams.append(key, value);
	});

	try {
		const response = await axios.get(url.toString(), {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			}
		});

		return response.data;
	} catch (err: any) {
		const message = err.response?.data?.error?.message || err.message || `DataFast API error: ${err.response?.status}`;
		throw new Error(message);
	}
};

const importDataFast = async (apiKey: string, site: typeof website.$inferSelect): Promise<ImportResult> => {
	const result: ImportResult = {
		sessionsCreated: 0,
		pageviewsCreated: 0,
		eventsCreated: 0,
		skippedRows: 0
	};

	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const startAt = thirtyDaysAgo.toISOString().split('T')[0];
	const endAt = now.toISOString().split('T')[0];

	let overview: DataFastOverview;
	let timeSeries: DataFastTimeSeries[] = [];
	let pages: DataFastPages[] = [];
	let referrers: DataFastReferrers[] = [];
	let devices: DataFastDevices[] = [];
	let browsers: DataFastBrowsers[] = [];
	let countries: DataFastCountries[] = [];

	try {
		const overviewData = await fetchDataFast('/analytics/overview', apiKey, { startAt, endAt });
		overview = overviewData.data[0];
	} catch (e) {
		console.error('Failed to fetch overview:', e);
		throw error(400, 'Failed to fetch data from DataFast. Please check your API key.');
	}

	try {
		const timeseriesData = await fetchDataFast('/analytics/timeseries', apiKey, {
			fields: 'visitors,sessions,revenue',
			interval: 'day',
			startAt,
			endAt,
			limit: '30'
		});
		timeSeries = timeseriesData.data || [];
	} catch (e) {
		console.error('Failed to fetch time series:', e);
	}

	try {
		const timeseriesData = await fetchDataFast('/analytics/timeseries', apiKey, {
			fields: 'visitors,sessions,revenue',
			interval: 'day',
			startAt,
			endAt,
			limit: '30'
		});
		timeSeries = timeseriesData.data || [];
	} catch (e) {
		console.error('Failed to fetch time series:', e);
	}

	try {
		const pagesData = await fetchDataFast('/analytics/pages', apiKey, {
			startAt,
			endAt,
			limit: '500'
		});
		pages = pagesData.data || [];
	} catch (e) {
		console.error('Failed to fetch pages:', e);
	}

	try {
		const referrersData = await fetchDataFast('/analytics/referrers', apiKey, {
			startAt,
			endAt,
			limit: '500'
		});
		referrers = referrersData.data || [];
	} catch (e) {
		console.error('Failed to fetch referrers:', e);
	}

	try {
		const devicesData = await fetchDataFast('/analytics/devices', apiKey, {
			startAt,
			endAt,
			limit: '10'
		});
		devices = devicesData.data || [];
	} catch (e) {
		console.error('Failed to fetch devices:', e);
	}

	try {
		const browsersData = await fetchDataFast('/analytics/browsers', apiKey, {
			startAt,
			endAt,
			limit: '10'
		});
		browsers = browsersData.data || [];
	} catch (e) {
		console.error('Failed to fetch browsers:', e);
	}

	try {
		const countriesData = await fetchDataFast('/analytics/countries', apiKey, {
			startAt,
			endAt,
			limit: '50'
		});
		countries = countriesData.data || [];
	} catch (e) {
		console.error('Failed to fetch countries:', e);
	}

	const totalVisitors = overview?.visitors || 0;
	const totalRevenue = overview?.revenue || 0;
	const totalSessions = overview?.sessions || 0;

	if (totalVisitors === 0) {
		return result;
	}

	const dayMap = new Map<string, { visitors: number; sessions: number; revenue: number }>();
	for (const ts of timeSeries) {
		const date = ts.timestamp.split('T')[0];
		dayMap.set(date, { visitors: ts.visitors || 0, sessions: ts.sessions || 0, revenue: ts.revenue || 0 });
	}

	const days = Array.from(dayMap.keys()).sort();

	const getWeightedRandom = <T extends { visitors?: number }>(arr: T[]): T => {
		if (arr.length === 0) return {} as T;
		if (arr.length === 1) return arr[0];
		return arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
	};

	const numToImport = Math.min(totalVisitors, 5000);
	const visitorsPerDay = Math.ceil(numToImport / Math.max(days.length, 1));

	for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
		const day = days[dayIdx];
		const dayData = dayMap.get(day) || { visitors: 0, sessions: 0, revenue: 0 };

		if (dayData.visitors === 0) continue;

		const dayDate = new Date(day);
		const dayStartHour = 8 + Math.floor(dayIdx * 2);
		dayDate.setHours(dayStartHour, 0, 0, 0);

		const numVisitorsToday = Math.min(dayData.visitors, Math.ceil(visitorsPerDay * (dayData.visitors / Math.max(totalVisitors, 1))));
		const dayRevenue = dayData.revenue || 0;

		for (let i = 0; i < numVisitorsToday; i++) {
			const sessionDate = new Date(dayDate);
			sessionDate.setMinutes(i * Math.floor(1440 / Math.max(numVisitorsToday, 1)));

			const visitorDevice = getWeightedRandom(devices);
			const visitorBrowser = getWeightedRandom(browsers);
			const visitorCountry = getWeightedRandom(countries);
			const visitorReferrer = getWeightedRandom(referrers);

			const [newVisitor] = await db
				.insert(visitor)
				.values({
					websiteId: site.id,
					firstSeen: sessionDate,
					lastSeen: sessionDate
				})
				.returning({ id: visitor.id });

			const [newSession] = await db
				.insert(analyticsSession)
				.values({
					websiteId: site.id,
					visitorId: newVisitor.id,
					startedAt: sessionDate,
					expiresAt: new Date(sessionDate.getTime() + 30 * 60 * 1000),
					lastActivityAt: sessionDate,
					referrer: visitorReferrer?.referrer || null,
					browser: visitorBrowser?.browser || 'Unknown',
					os: visitorBrowser?.browser === 'Safari' ? 'macOS' : visitorBrowser?.browser === 'Chrome' ? 'Windows' : 'Unknown',
					deviceType: normalizeDevice(visitorDevice?.device || 'Desktop'),
					country: visitorCountry?.country || null,
					region: null,
					city: null
				})
				.returning({ id: analyticsSession.id });

			result.sessionsCreated++;

			const visitorPages = pages.slice(0, Math.min(pages.length, 10));
			const numPages = Math.max(1, Math.floor(Math.random() * 4) + 1);

			for (let j = 0; j < numPages; j++) {
				const page = visitorPages[j % Math.max(visitorPages.length, 1)];
				if (page) {
					const pvDate = new Date(sessionDate.getTime() + j * 30000 + Math.random() * 10000);

					await db.insert(pageview).values({
						sessionId: newSession.id,
						websiteId: site.id,
						url: page.path,
						pathname: page.path,
						referrer: visitorReferrer?.referrer || null,
						title: null,
						timestamp: pvDate
					});
					result.pageviewsCreated++;
				}
			}

			if (dayRevenue > 0 && totalRevenue > 0 && i < Math.ceil(numVisitorsToday * 0.05)) {
				const avgOrderValue = totalRevenue / Math.max(overview?.sessions || 1, 1);
				const paymentAmount = Math.round(avgOrderValue * (0.5 + Math.random()));

				await db.insert(payment).values({
					websiteId: site.id,
					visitorId: newVisitor.id,
					sessionId: newSession.id,
					amount: paymentAmount,
					currency: 'USD',
					transactionId: `datafast-import-${day}-${i}`,
					timestamp: sessionDate
				});
			}
		}
	}

	return result;
};

const parseCSV = <T>(csvText: string): T[] => {
	const lines = csvText.split('\n');
	if (lines.length < 2) return [];

	const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
	const rows: T[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const values: string[] = [];
		let current = '';
		let inQuotes = false;

		for (const char of line) {
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				values.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
		values.push(current.trim());

		const row: Record<string, string> = {};
		headers.forEach((header, index) => {
			row[header] = values[index] || '';
		});

		rows.push(row as T);
	}

	return rows;
};

const parseScreen = (screen: string): { width: number | null; height: number | null } => {
	if (!screen) return { width: null, height: null };
	const [width, height] = screen.split('x').map(Number);
	return { width: width || null, height: height || null };
};

const parseTimestamp = (timestamp: string): Date | null => {
	if (!timestamp || timestamp === '\\N') return null;
	try {
		const date = new Date(timestamp.replace(' ', 'T') + 'Z');
		return isNaN(date.getTime()) ? null : date;
	} catch {
		return null;
	}
};

const BROWSER_MAP: Record<string, string> = {
	chrome: 'Chrome',
	firefox: 'Firefox',
	safari: 'Safari',
	edge: 'Edge',
	'edge-chromium': 'Edge',
	opera: 'Opera',
	ie: 'IE',
	'internet explorer': 'IE',
	brave: 'Chrome',
	vivaldi: 'Chrome',
	samsung: 'Chrome',
	uc: 'Chrome',
	yandex: 'Chrome',
	unknown: 'Unknown'
};

const normalizeBrowser = (browser: string): string => {
	if (!browser) return 'Unknown';
	const normalized = browser.toLowerCase().trim();
	return BROWSER_MAP[normalized] || 'Unknown';
};

const OS_MAP: Record<string, string> = {
	windows: 'Windows',
	'windows 10': 'Windows',
	'windows 11': 'Windows',
	'windows 8': 'Windows',
	'windows 8.1': 'Windows',
	'windows 7': 'Windows',
	'windows vista': 'Windows',
	'windows xp': 'Windows',
	'mac os': 'macOS',
	macos: 'macOS',
	'mac os x': 'macOS',
	ios: 'iOS',
	'iphone os': 'iOS',
	android: 'Android',
	linux: 'Linux',
	ubuntu: 'Linux',
	fedora: 'Linux',
	debian: 'Linux',
	'red hat': 'Linux',
	centos: 'Linux',
	'chrome os': 'Chrome OS',
	chromeos: 'Chrome OS',
	cros: 'Chrome OS',
	unknown: 'Unknown'
};

const normalizeOS = (os: string): string => {
	if (!os) return 'Unknown';
	const normalized = os.toLowerCase().trim();
	return OS_MAP[normalized] || 'Unknown';
};

const DEVICE_MAP: Record<string, string> = {
	laptop: 'Desktop',
	desktop: 'Desktop',
	mobile: 'Mobile',
	tablet: 'Tablet',
	phone: 'Mobile',
	smartphone: 'Mobile',
	tv: 'Desktop',
	console: 'Desktop',
	wearable: 'Mobile',
	'smart-tv': 'Desktop',
	unknown: 'Desktop'
};

const normalizeDevice = (device: string): string => {
	if (!device) return 'Desktop';
	const normalized = device.toLowerCase().trim();
	return DEVICE_MAP[normalized] || 'Desktop';
};

const parseDate = (dateStr: string): Date | null => {
	if (!dateStr) return null;
	try {
		const date = new Date(dateStr + 'T00:00:00Z');
		return isNaN(date.getTime()) ? null : date;
	} catch {
		return null;
	}
};

const importUmami = async (csvText: string, site: typeof website.$inferSelect): Promise<ImportResult> => {
	const result: ImportResult = {
		sessionsCreated: 0,
		pageviewsCreated: 0,
		eventsCreated: 0,
		skippedRows: 0
	};

	const events = parseCSV<UmamiEvent>(csvText);
	if (events.length === 0) return result;

	const sessionMap = new Map<string, string>();
	const visitorMap = new Map<string, string>();

	const eventTypes: Record<number, 'pageview' | 'event'> = {
		1: 'pageview',
		2: 'event'
	};

	const sessionGroups = new Map<string, UmamiEvent[]>();
	for (const event of events) {
		if (!event.session_id) {
			result.skippedRows++;
			continue;
		}
		const key = event.session_id;
		if (!sessionGroups.has(key)) {
			sessionGroups.set(key, []);
		}
		sessionGroups.get(key)!.push(event);
	}

	for (const [sessionId, sessionEvents] of sessionGroups) {
		const firstEvent = sessionEvents[0];
		const lastEvent = sessionEvents[sessionEvents.length - 1];

		const screen = parseScreen(firstEvent.screen);
		const startedAt = parseTimestamp(firstEvent.created_at) || new Date();
		const lastActivityAt = parseTimestamp(lastEvent.created_at) || startedAt;

		let visitorId: string;

		if (visitorMap.has(sessionId)) {
			visitorId = visitorMap.get(sessionId)!;
		} else {
			const [newVisitor] = await db
				.insert(visitor)
				.values({
					websiteId: site.id,
					firstSeen: startedAt,
					lastSeen: lastActivityAt
				})
				.returning({ id: visitor.id });

			visitorId = newVisitor.id;
			visitorMap.set(sessionId, visitorId);
		}

		let dbSessionId: string;

		if (sessionMap.has(sessionId)) {
			dbSessionId = sessionMap.get(sessionId)!;
		} else {
			const [newSession] = await db
				.insert(analyticsSession)
				.values({
					websiteId: site.id,
					visitorId,
					startedAt,
					expiresAt: new Date(lastActivityAt.getTime() + 30 * 60 * 1000),
					lastActivityAt,
					referrer: firstEvent.referrer_domain || null,
					utmSource: firstEvent.utm_source || null,
					utmMedium: firstEvent.utm_medium || null,
					utmCampaign: firstEvent.utm_campaign || null,
					screenWidth: screen.width,
					screenHeight: screen.height,
					language: firstEvent.language || null,
					browser: normalizeBrowser(firstEvent.browser),
					os: normalizeOS(firstEvent.os),
					deviceType: normalizeDevice(firstEvent.device),
					country: firstEvent.country || null,
					region: firstEvent.region || null,
					city: firstEvent.city || null
				})
				.returning({ id: analyticsSession.id });

			dbSessionId = newSession.id;
			sessionMap.set(sessionId, dbSessionId);
			result.sessionsCreated++;
		}

		for (const event of sessionEvents) {
			const timestamp = parseTimestamp(event.created_at);
			if (!timestamp) {
				result.skippedRows++;
				continue;
			}

			const eventType = eventTypes[event.event_type];

			if (eventType === 'pageview') {
				await db.insert(pageview).values({
					sessionId: dbSessionId,
					websiteId: site.id,
					url: event.url_path,
					pathname: event.url_path,
					referrer: event.referrer_domain || null,
					title: event.page_title || null,
					timestamp
				});
				result.pageviewsCreated++;
			} else if (eventType === 'event' && event.event_name) {
				await db.insert(analyticsEvent).values({
					sessionId: dbSessionId,
					websiteId: site.id,
					type: 'custom',
					name: event.event_name,
					data: event.tag ? { tag: event.tag } : null,
					timestamp
				});
				result.eventsCreated++;
			} else {
				result.skippedRows++;
			}
		}
	}

	return result;
};

interface PlausibleData {
	visitors: PlausibleVisitors[];
	pages: PlausiblePages[];
	browsers: PlausibleBrowsers[];
	devices: PlausibleDevices[];
	os: PlausibleOS[];
	locations: PlausibleLocations[];
	sources: PlausibleSources[];
	events: PlausibleEvents[];
}

const importPlausible = async (files: Map<string, string>, site: typeof website.$inferSelect): Promise<ImportResult> => {
	const result: ImportResult = {
		sessionsCreated: 0,
		pageviewsCreated: 0,
		eventsCreated: 0,
		skippedRows: 0
	};

	const data: PlausibleData = {
		visitors: [],
		pages: [],
		browsers: [],
		devices: [],
		os: [],
		locations: [],
		sources: [],
		events: []
	};

	for (const [filename, content] of files) {
		if (filename.includes('visitors')) {
			data.visitors = parseCSV<PlausibleVisitors>(content);
		} else if (filename.includes('pages') && !filename.includes('entry') && !filename.includes('exit')) {
			data.pages = parseCSV<PlausiblePages>(content);
		} else if (filename.includes('browsers')) {
			data.browsers = parseCSV<PlausibleBrowsers>(content);
		} else if (filename.includes('devices')) {
			data.devices = parseCSV<PlausibleDevices>(content);
		} else if (filename.includes('operating_systems')) {
			data.os = parseCSV<PlausibleOS>(content);
		} else if (filename.includes('locations')) {
			data.locations = parseCSV<PlausibleLocations>(content);
		} else if (filename.includes('sources')) {
			data.sources = parseCSV<PlausibleSources>(content);
		} else if (filename.includes('custom_events')) {
			data.events = parseCSV<PlausibleEvents>(content);
		}
	}

	if (data.visitors.length === 0) {
		throw error(400, 'No visitor data found in Plausible export');
	}

	for (const visitorDay of data.visitors) {
		const date = parseDate(visitorDay.date);
		if (!date) {
			result.skippedRows++;
			continue;
		}

		const visitorCount = parseInt(visitorDay.visitors) || 0;
		const pageviewCount = parseInt(visitorDay.pageviews) || 0;

		if (visitorCount === 0) continue;

		const dayStr = visitorDay.date;

		const dayPages = data.pages.filter((p) => p.date === dayStr);
		const dayBrowsers = data.browsers.filter((b) => b.date === dayStr);
		const dayDevices = data.devices.filter((d) => d.date === dayStr);
		const dayOS = data.os.filter((o) => o.date === dayStr);
		const dayLocations = data.locations.filter((l) => l.date === dayStr);
		const daySources = data.sources.filter((s) => s.date === dayStr);
		const dayEvents = data.events.filter((e) => e.date === dayStr);

		const primaryBrowser = dayBrowsers[0]?.browser || 'Unknown';
		const primaryDevice = dayDevices[0]?.device || 'Desktop';
		const primaryOS = dayOS[0]?.operating_system || 'Unknown';
		const primaryLocation = dayLocations[0];
		const primarySource = daySources[0];

		for (let i = 0; i < visitorCount; i++) {
			const sessionId = `plausible-${dayStr}-${i}`;
			const sessionDate = new Date(date.getTime() + i * 60000);

			const [newVisitor] = await db
				.insert(visitor)
				.values({
					websiteId: site.id,
					firstSeen: sessionDate,
					lastSeen: sessionDate
				})
				.returning({ id: visitor.id });

			const [newSession] = await db
				.insert(analyticsSession)
				.values({
					websiteId: site.id,
					visitorId: newVisitor.id,
					startedAt: sessionDate,
					expiresAt: new Date(sessionDate.getTime() + 30 * 60 * 1000),
					lastActivityAt: sessionDate,
					referrer: primarySource?.referrer || primarySource?.source || null,
					utmSource: primarySource?.utm_source || null,
					utmMedium: primarySource?.utm_medium || null,
					utmCampaign: primarySource?.utm_campaign || null,
					browser: normalizeBrowser(primaryBrowser),
					os: normalizeOS(primaryOS),
					deviceType: normalizeDevice(primaryDevice),
					country: primaryLocation?.country || null,
					region: primaryLocation?.region || null,
					city: primaryLocation?.city || null
				})
				.returning({ id: analyticsSession.id });

			result.sessionsCreated++;

			const pagesPerVisitor = Math.ceil(pageviewCount / visitorCount);
			const visitorPages = dayPages.slice(0, pagesPerVisitor);

			for (let j = 0; j < visitorPages.length; j++) {
				const page = visitorPages[j];
				const pvDate = new Date(sessionDate.getTime() + j * 30000);

				await db.insert(pageview).values({
					sessionId: newSession.id,
					websiteId: site.id,
					url: page.page,
					pathname: page.page,
					referrer: primarySource?.referrer || null,
					title: null,
					timestamp: pvDate
				});
				result.pageviewsCreated++;
			}

			const visitorEvents = dayEvents.slice(0, 1);
			for (const evt of visitorEvents) {
				await db.insert(analyticsEvent).values({
					sessionId: newSession.id,
					websiteId: site.id,
					type: 'custom',
					name: evt.name,
					data: evt.path ? { path: evt.path } : null,
					timestamp: sessionDate
				});
				result.eventsCreated++;
			}
		}
	}

	return result;
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) {
		throw error(404, 'Website not found');
	}

	if (!access.isOwner) {
		throw error(403, 'Only the website owner can import data');
	}

	const site = access.site;

	const formData = await request.formData();
	const platformValidation = importSchema.safeParse({
		platform: formData.get('platform') || 'umami',
		apiKey: formData.get('apiKey') || undefined
	});
	if (!platformValidation.success) {
		throw error(400, 'Invalid platform');
	}
	const { platform, apiKey } = platformValidation.data;

	let result: ImportResult;

	if (platform === 'datafast') {
		if (!apiKey) {
			throw error(400, 'API key is required for DataFast import');
		}

		result = await importDataFast(apiKey, site);
	} else if (platform === 'plausible') {
		const files = new Map<string, string>();
		const filesData = formData.getAll('files');

		if (filesData.length === 0) {
			const file = formData.get('file');
			if (file && file instanceof File) {
				const csvText = await file.text();
				files.set(file.name, csvText);
			}
		} else {
			for (const file of filesData) {
				if (file instanceof File) {
					const csvText = await file.text();
					files.set(file.name, csvText);
				}
			}
		}

		if (files.size === 0) {
			throw error(400, 'No files uploaded for Plausible import');
		}

		result = await importPlausible(files, site);
	} else {
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw error(400, 'No file uploaded');
		}

		if (!file.name.endsWith('.csv')) {
			throw error(400, 'Invalid file. Expected a CSV file');
		}

		const csvText = await file.text();
		result = await importUmami(csvText, site);
	}

	return json({
		success: true,
		message: `Imported ${result.sessionsCreated} sessions, ${result.pageviewsCreated} pageviews, and ${result.eventsCreated} events`,
		result
	});
};

interface DataFastImportPayload {
	overview: DataFastOverview;
	timeSeries: DataFastTimeSeries[];
	pages: DataFastPages[];
	referrers: DataFastReferrers[];
	devices: DataFastDevices[];
	browsers: DataFastBrowsers[];
	countries: DataFastCountries[];
}

const importDataFastData = async (data: DataFastImportPayload, site: typeof website.$inferSelect): Promise<ImportResult> => {
	const result: ImportResult = {
		sessionsCreated: 0,
		pageviewsCreated: 0,
		eventsCreated: 0,
		skippedRows: 0
	};

	const { overview, timeSeries, pages, referrers, devices, browsers, countries } = data;

	const totalVisitors = overview?.visitors || 0;
	const totalRevenue = overview?.revenue || 0;

	if (totalVisitors === 0) {
		return result;
	}

	const dayMap = new Map<string, { visitors: number; sessions: number; revenue: number }>();
	for (const ts of timeSeries) {
		const date = ts.timestamp.split('T')[0];
		dayMap.set(date, { visitors: ts.visitors || 0, sessions: ts.sessions || 0, revenue: ts.revenue || 0 });
	}

	const days = Array.from(dayMap.keys()).sort();

	const getWeightedRandom = <T extends { visitors?: number }>(arr: T[]): T => {
		if (arr.length === 0) return {} as T;
		if (arr.length === 1) return arr[0];
		return arr[Math.floor(Math.random() * Math.min(arr.length, 10))];
	};

	const numToImport = Math.min(totalVisitors, 10000);

	for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
		const day = days[dayIdx];
		const dayData = dayMap.get(day) || { visitors: 0, sessions: 0 };

		if (dayData.visitors === 0) continue;

		const dayDate = new Date(day);
		const dayStartHour = 8 + Math.floor(dayIdx * 2);
		dayDate.setHours(dayStartHour, 0, 0, 0);

		const numVisitorsToday = Math.min(dayData.visitors, Math.ceil(numToImport * (dayData.visitors / Math.max(totalVisitors, 1))));

		for (let i = 0; i < numVisitorsToday; i++) {
			const sessionDate = new Date(dayDate);
			sessionDate.setMinutes(i * Math.floor(1440 / Math.max(numVisitorsToday, 1)));

			const visitorDevice = getWeightedRandom(devices);
			const visitorBrowser = getWeightedRandom(browsers);
			const visitorCountry = getWeightedRandom(countries);
			const visitorReferrer = getWeightedRandom(referrers);

			const [newVisitor] = await db
				.insert(visitor)
				.values({
					websiteId: site.id,
					firstSeen: sessionDate,
					lastSeen: sessionDate
				})
				.returning({ id: visitor.id });

			const [newSession] = await db
				.insert(analyticsSession)
				.values({
					websiteId: site.id,
					visitorId: newVisitor.id,
					startedAt: sessionDate,
					expiresAt: new Date(sessionDate.getTime() + 30 * 60 * 1000),
					lastActivityAt: sessionDate,
					referrer: visitorReferrer?.referrer || null,
					browser: visitorBrowser?.browser || 'Unknown',
					os: visitorBrowser?.browser === 'Safari' ? 'macOS' : visitorBrowser?.browser === 'Chrome' ? 'Windows' : 'Unknown',
					deviceType: normalizeDevice(visitorDevice?.device || 'Desktop'),
					country: visitorCountry?.country || null,
					region: null,
					city: null
				})
				.returning({ id: analyticsSession.id });

			result.sessionsCreated++;

			const visitorPages = pages.slice(0, Math.min(pages.length, 10));
			const numPages = Math.max(1, Math.floor(Math.random() * 4) + 1);

			for (let j = 0; j < numPages; j++) {
				const page = visitorPages[j % Math.max(visitorPages.length, 1)];
				if (page) {
					const pvDate = new Date(sessionDate.getTime() + j * 30000 + Math.random() * 10000);

					await db.insert(pageview).values({
						sessionId: newSession.id,
						websiteId: site.id,
						url: page.path,
						pathname: page.path,
						referrer: visitorReferrer?.referrer || null,
						title: null,
						timestamp: pvDate
					});
					result.pageviewsCreated++;
				}
			}
		}
	}

	return result;
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) {
		throw error(404, 'Website not found');
	}

	if (!access.isOwner) {
		throw error(403, 'Only the website owner can import data');
	}

	const site = access.site;

	const body = await request.json();

	if (!body.overview || !body.timeSeries) {
		throw error(400, 'Missing required data');
	}

	const result = await importDataFastData(body, site);

	return json({
		success: true,
		message: `Imported ${result.sessionsCreated} sessions, ${result.pageviewsCreated} pageviews, and ${result.eventsCreated} events`,
		result
	});
};
