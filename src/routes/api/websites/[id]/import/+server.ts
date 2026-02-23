import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsSession, pageview, visitor, analyticsEvent, website } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { importSchema } from '$lib/server/validation';

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
	const platformValidation = importSchema.safeParse({ platform: formData.get('platform') || 'umami' });
	if (!platformValidation.success) {
		throw error(400, 'Invalid platform');
	}
	const platform = platformValidation.data.platform;

	let result: ImportResult;

	if (platform === 'plausible') {
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
