import { SESSION_EXPIRY_MINUTES, GEO_CACHE_TTL_MS, GEO_CACHE_MAX_SIZE, MAX_STRING_LENGTHS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, COUNTRY_OPTIONS } from '@/utils/constants';
import { website, visitor, analyticsSession, pageview, analyticsEvent, payment, user } from '$lib/server/db/schema';
import { sanitizeString, extractPathname, extractUtmParams } from '$lib/server/utils';
import { generateVisitorName, generateAvatarUrl } from '$lib/server/visitor-utils';
import { trackingPayloadSchema, validateBody } from '$lib/server/validation';
import TrafficSpikeEmail from '$lib/server/email/templates/TrafficSpikeEmail';
import type { TrackingPayload, GeoData } from '$lib/server/types';
import { sendEmail, isEmailConfigured } from '$lib/server/email';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import db from '$lib/server/db';
import axios from 'axios';

const SPIKE_COOLDOWN_MS = 15 * 60 * 1000;
const ORIGIN = env.ORIGIN;

interface SessionTimestamp {
	websiteId: string;
	timestamp: number;
}

interface GeoCacheEntry {
	data: GeoData;
	expiresAt: number;
	lastAccessed: number;
}

interface RateLimitEntry {
	count: number;
	windowStart: number;
}

const sessionTimestamps: SessionTimestamp[] = [];
const lastSpikeNotification: Map<string, number> = new Map();

const rateLimitMap = new Map<string, RateLimitEntry>();

const checkRateLimit = (key: string): boolean => {
	const now = Date.now();
	const entry = rateLimitMap.get(key);

	if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
		rateLimitMap.set(key, { count: 1, windowStart: now });
		return true;
	}

	if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}

	entry.count++;
	return true;
};

const cleanupRateLimitMap = () => {
	const now = Date.now();
	for (const [key, entry] of rateLimitMap.entries()) {
		if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
			rateLimitMap.delete(key);
		}
	}
};

setInterval(cleanupRateLimitMap, 60000);

const checkTrafficSpike = async (websiteId: string, notifications: { trafficSpike: { enabled: boolean; threshold: number; windowSeconds: number } } | undefined, now: Date) => {
	if (!notifications?.trafficSpike?.enabled) return;

	const { threshold, windowSeconds } = notifications.trafficSpike;
	const windowMs = windowSeconds * 1000;
	const nowTs = now.getTime();

	sessionTimestamps.push({ websiteId, timestamp: nowTs });

	const windowStart = nowTs - windowMs;
	const recentSessions = sessionTimestamps.filter((s) => s.websiteId === websiteId && s.timestamp > windowStart).length;

	if (recentSessions >= threshold) {
		const lastNotification = lastSpikeNotification.get(websiteId) || 0;
		if (nowTs - lastNotification < SPIKE_COOLDOWN_MS) return;

		const [siteData] = await db.select().from(website).where(eq(website.id, websiteId)).limit(1);
		if (!siteData) return;

		const [owner] = await db.select().from(user).where(eq(user.id, siteData.userId)).limit(1);
		if (!owner?.email) return;

		if (!isEmailConfigured()) {
			console.log('[Traffic Spike] Email not configured, skipping notification');
			return;
		}

		const result = await sendEmail({
			to: owner.email,
			subject: `Traffic Spike Alert - ${siteData.domain}`,
			children: TrafficSpikeEmail({ domain: siteData.domain, visitors: recentSessions, threshold, windowSeconds, date: now.toISOString(), dashboardUrl: `${ORIGIN}/dashboard/${siteData.id}` }),
			plain: `Your website ${siteData.domain} is experiencing a traffic spike! ${recentSessions} visitors in the last ${windowSeconds} seconds (threshold: ${threshold}). Detected at ${now.toISOString()}`
		});

		if (result) {
			lastSpikeNotification.set(websiteId, nowTs);
			console.log(`[Traffic Spike] Notification sent for ${siteData.domain}: ${recentSessions} visitors`);
		}
	}
};

setInterval(() => {
	const cutoff = Date.now() - 3600000;
	let writeIdx = 0;
	for (let readIdx = 0; readIdx < sessionTimestamps.length; readIdx++) {
		if (sessionTimestamps[readIdx].timestamp >= cutoff) {
			if (writeIdx !== readIdx) {
				sessionTimestamps[writeIdx] = sessionTimestamps[readIdx];
			}
			writeIdx++;
		}
	}
	sessionTimestamps.length = writeIdx;
}, 300000);

const getClientIP = (request: Request, socketIP?: string): string | null => {
	const xForwardedFor = request.headers.get('x-forwarded-for');
	if (xForwardedFor) {
		const ips = xForwardedFor.split(',').map((ip) => ip.trim());
		for (const ip of ips) {
			if (ip && !isPrivateIP(ip)) {
				return ip;
			}
		}
	}

	const xRealIP = request.headers.get('x-real-ip');
	if (xRealIP && !isPrivateIP(xRealIP)) {
		return xRealIP;
	}

	const cfConnectingIP = request.headers.get('cf-connecting-ip');
	if (cfConnectingIP && !isPrivateIP(cfConnectingIP)) {
		return cfConnectingIP;
	}

	const xVercelProxySignature = request.headers.get('x-vercel-proxy-signature');
	if (xVercelProxySignature) {
		const xVercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
		if (xVercelForwardedFor) {
			const ips = xVercelForwardedFor.split(',').map((ip) => ip.trim());
			for (const ip of ips) {
				if (ip && !isPrivateIP(ip)) {
					return ip;
				}
			}
		}
	}

	const socketAddr = socketIP;
	if (socketAddr && !isPrivateIP(socketAddr)) {
		return socketAddr;
	}

	return null;
};

const isPrivateIP = (ip: string): boolean => {
	if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
	const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^169\.254\./, /^fc00:/i, /^fe80:/i];
	return privateRanges.some((range) => range.test(ip));
};

const matchIp = (clientIp: string, pattern: string): boolean => {
	const normalizedClient = clientIp.toLowerCase().trim();
	const normalizedPattern = pattern.toLowerCase().trim();

	if (normalizedPattern.includes('/')) {
		return matchIpCidr(normalizedClient, normalizedPattern);
	}

	if (normalizedPattern.includes('*')) {
		const patternOctets = normalizedPattern.split('.');
		const clientOctets = normalizedClient.split('.');

		if (patternOctets.length !== 4 || clientOctets.length !== 4) return false;

		for (let i = 0; i < 4; i++) {
			const patternOctet = patternOctets[i];
			const clientOctet = clientOctets[i];

			if (patternOctet !== '*' && patternOctet !== clientOctet) {
				return false;
			}
		}
		return true;
	}

	const patternOctets = normalizedPattern.split('.');
	const clientOctets = normalizedClient.split('.');
	if (patternOctets.length !== 4 || clientOctets.length !== 4) return false;

	return normalizedClient === normalizedPattern;
};

const matchIpCidr = (ip: string, cidr: string): boolean => {
	try {
		const [range, bitsStr] = cidr.split('/');
		const bits = parseInt(bitsStr, 10);

		if (ip.includes(':') || range.includes(':')) {
			return false;
		}

		const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
		const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
		const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;

		return (ipNum & mask) === (rangeNum & mask);
	} catch {
		return false;
	}
};

const matchPath = (pathname: string, pattern: string): boolean => {
	const normalizedPath = pathname.toLowerCase();
	const normalizedPattern = pattern.toLowerCase();

	if (normalizedPattern.includes('*')) {
		const escapedPattern = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
		const regexPattern = escapedPattern.replace(/\*/g, '[^/]*');
		return new RegExp(`^${regexPattern}$`).test(normalizedPath);
	}

	return normalizedPath === normalizedPattern;
};

const geoCache = new Map<string, GeoCacheEntry>();

const cleanupGeoCache = () => {
	const now = Date.now();
	for (const [key, entry] of geoCache.entries()) {
		if (entry.expiresAt < now) {
			geoCache.delete(key);
		}
	}
	if (geoCache.size > GEO_CACHE_MAX_SIZE) {
		const entries = Array.from(geoCache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
		const toDelete = entries.slice(0, geoCache.size - GEO_CACHE_MAX_SIZE);
		for (const [key] of toDelete) {
			geoCache.delete(key);
		}
	}
};

setInterval(cleanupGeoCache, GEO_CACHE_TTL_MS);

const getGeoData = async (ip: string | null): Promise<GeoData> => {
	if (!ip) {
		return { country: null, region: null, city: null };
	}

	const now = Date.now();
	const cached = geoCache.get(ip);
	if (cached && cached.expiresAt > now) {
		cached.lastAccessed = now;
		return cached.data;
	}

	const result = await fetchGeoFromProviders(ip);
	if (result) {
		geoCache.set(ip, { data: result, expiresAt: now + GEO_CACHE_TTL_MS, lastAccessed: now });
		cleanupGeoCache();
		return result;
	}

	const fallback: GeoData = { country: null, region: null, city: null };
	geoCache.set(ip, { data: fallback, expiresAt: now + GEO_CACHE_TTL_MS, lastAccessed: now });
	return fallback;
};

const fetchGeoFromProviders = async (ip: string): Promise<GeoData | null> => {
	const providers: Array<() => Promise<GeoData | null>> = [() => fetchFromIpwhoIs(ip), () => fetchFromIpApi(ip)];

	for (const provider of providers) {
		try {
			const result = await provider();
			if (result?.country) return result;
		} catch (e) {
			console.error('[GeoIP] Provider error:', e);
		}
	}
	return null;
};

const fetchFromIpwhoIs = async (ip: string): Promise<GeoData | null> => {
	const response = await axios.get(`https://ipwho.is/${ip}`, { timeout: 3000 });
	const data = response.data;
	if (data.success && data.country) {
		return { country: data.country, region: data.region || null, city: data.city || null };
	}
	return null;
};

const fetchFromIpApi = async (ip: string): Promise<GeoData | null> => {
	const response = await axios.get(`http://ip-api.com/json/${ip}`, {
		params: { fields: 'status,country,regionName,city' },
		timeout: 3000
	});
	const data = response.data;
	if (data.status === 'success' && data.country) {
		return { country: data.country, region: data.regionName || null, city: data.city || null };
	}
	return null;
};

const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
	const defaultCors = {
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Origin': '*'
	};

	return defaultCors;
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const requestOrigin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(requestOrigin);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
	}

	const validation = validateBody(trackingPayloadSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400, headers: corsHeaders });
	}

	const rawPayload = validation.data;
	const payload: TrackingPayload = {
		websiteId: sanitizeString(rawPayload.websiteId, MAX_STRING_LENGTHS.websiteId),
		domain: sanitizeString(rawPayload.domain, MAX_STRING_LENGTHS.domain),
		type: rawPayload.type,
		href: sanitizeString(rawPayload.href, MAX_STRING_LENGTHS.href),
		referrer: rawPayload.referrer ? sanitizeString(rawPayload.referrer, MAX_STRING_LENGTHS.referrer) : null,
		visitorId: sanitizeString(rawPayload.visitorId, MAX_STRING_LENGTHS.visitorId),
		sessionId: sanitizeString(rawPayload.sessionId, MAX_STRING_LENGTHS.sessionId),
		viewport: rawPayload.viewport,
		screenWidth: rawPayload.screenWidth || 0,
		screenHeight: rawPayload.screenHeight || 0,
		language: rawPayload.language ? sanitizeString(rawPayload.language, MAX_STRING_LENGTHS.language) : undefined,
		timezone: rawPayload.timezone ? sanitizeString(rawPayload.timezone, MAX_STRING_LENGTHS.timezone) : undefined,
		browser: rawPayload.browser ? sanitizeString(rawPayload.browser, MAX_STRING_LENGTHS.browser) : undefined,
		browserVersion: rawPayload.browserVersion ? sanitizeString(rawPayload.browserVersion, MAX_STRING_LENGTHS.browserVersion) : undefined,
		os: rawPayload.os ? sanitizeString(rawPayload.os, MAX_STRING_LENGTHS.os) : undefined,
		osVersion: rawPayload.osVersion ? sanitizeString(rawPayload.osVersion, MAX_STRING_LENGTHS.osVersion) : undefined,
		deviceType: rawPayload.deviceType ? sanitizeString(rawPayload.deviceType, MAX_STRING_LENGTHS.deviceType) : undefined,
		isPwa: rawPayload.isPwa || false,
		title: rawPayload.title ? sanitizeString(rawPayload.title, MAX_STRING_LENGTHS.title) : undefined,
		name: rawPayload.name ? sanitizeString(rawPayload.name, MAX_STRING_LENGTHS.eventName) : undefined,
		data: rawPayload.data,
		amount: rawPayload.amount,
		currency: rawPayload.currency ? sanitizeString(rawPayload.currency, MAX_STRING_LENGTHS.currency || 10) : undefined,
		transactionId: rawPayload.transactionId ? sanitizeString(rawPayload.transactionId, MAX_STRING_LENGTHS.transactionId || 255) : undefined
	};

	let socketIP: string | undefined;
	try {
		socketIP = getClientAddress();
	} catch {}

	let site;
	if (payload.websiteId) {
		[site] = await db.select().from(website).where(eq(website.id, payload.websiteId)).limit(1);
	} else {
		const domainKey = payload.domain
			.toLowerCase()
			.replace(/^https?:\/\//, '')
			.replace(/^www\./, '')
			.split(':')[0];
		[site] = await db
			.select()
			.from(website)
			.where(sql`LOWER(REPLACE(REPLACE(${website.domain}, 'https://', ''), 'http://', '')) = ${domainKey}`)
			.limit(1);
	}

	if (!site) {
		return json({ error: 'Website not found' }, { status: 404, headers: corsHeaders });
	}

	const clientIP = getClientIP(request, socketIP);
	const rateLimitKey = `${site.id}:${clientIP || socketIP || 'unknown'}`;
	if (!checkRateLimit(rateLimitKey)) {
		return json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders });
	}

	const pathname = extractPathname(payload.href);

	const excludedIps = (site.excludedIps as string[] | null) || [];
	const excludedPaths = (site.excludedPaths as string[] | null) || [];
	const excludedCountries = (site.excludedCountries as string[] | null) || [];

	if (clientIP && excludedIps.length > 0) {
		for (const excludedIp of excludedIps) {
			if (!excludedIp) continue;
			if (matchIp(clientIP, excludedIp)) {
				return json({ success: true, excluded: true }, { status: 200, headers: corsHeaders });
			}
		}
	}

	if (excludedPaths.length > 0 && pathname) {
		for (const excludedPath of excludedPaths) {
			if (!excludedPath) continue;
			if (matchPath(pathname, excludedPath)) {
				return json({ success: true, excluded: true }, { status: 200, headers: corsHeaders });
			}
		}
	}

	const geoData = await getGeoData(clientIP);

	if (excludedCountries.length > 0 && geoData.country) {
		if (COUNTRY_OPTIONS.includes(geoData.country as any) && excludedCountries.includes(geoData.country)) {
			return json({ success: true, excluded: true }, { status: 200, headers: corsHeaders });
		}
	}

	const requestDomain = payload.domain
		.toLowerCase()
		.replace(/^www\./, '')
		.split(':')[0];
	const siteDomain = site.domain
		.toLowerCase()
		.replace(/^www\./, '')
		.split(':')[0];
	const isLocalhost = requestDomain === 'localhost' || requestDomain === '127.0.0.1' || requestDomain.endsWith('.localhost');
	if (!isLocalhost && requestDomain !== siteDomain && !requestDomain.endsWith('.' + siteDomain)) {
		return json({ error: 'Domain mismatch' }, { status: 403, headers: corsHeaders });
	}

	const now = new Date();
	const sessionExpiry = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);

	const [existingVisitor, existingSession] = await Promise.all([
		db
			.select()
			.from(visitor)
			.where(and(eq(visitor.websiteId, site.id), eq(visitor.id, payload.visitorId)))
			.limit(1),
		db.select().from(analyticsSession).where(eq(analyticsSession.id, payload.sessionId)).limit(1)
	]);

	const visitorExists = existingVisitor.length > 0;
	const sessionExists = existingSession.length > 0;

	if (visitorExists) {
		const v = existingVisitor[0];
		const needsName = !v.name;
		const needsAvatar = !v.avatar;
		const lastSeenDiff = now.getTime() - v.lastSeen.getTime();
		const needsLastSeenUpdate = lastSeenDiff > 60000;

		if (needsName || needsAvatar || needsLastSeenUpdate) {
			const updateData: { lastSeen?: Date; name?: string; avatar?: string } = {};
			if (needsLastSeenUpdate) updateData.lastSeen = now;
			if (needsName) updateData.name = generateVisitorName(payload.visitorId);
			if (needsAvatar) updateData.avatar = generateAvatarUrl(payload.visitorId);
			await db.update(visitor).set(updateData).where(eq(visitor.id, v.id));
		}
	} else {
		await db.insert(visitor).values({
			id: payload.visitorId,
			websiteId: site.id,
			firstSeen: now,
			lastSeen: now,
			name: generateVisitorName(payload.visitorId),
			avatar: generateAvatarUrl(payload.visitorId)
		});
	}

	let sessionId = payload.sessionId;
	const utm = extractUtmParams(payload.href, payload.referrer ?? null);

	const sessionData = {
		id: payload.sessionId,
		visitorId: payload.visitorId,
		websiteId: site.id,
		startedAt: now,
		expiresAt: sessionExpiry,
		lastActivityAt: now,
		referrer: payload.referrer || null,
		utmSource: utm.source,
		utmMedium: utm.medium,
		utmCampaign: utm.campaign,
		screenWidth: payload.screenWidth || null,
		screenHeight: payload.screenHeight || null,
		language: payload.language || null,
		timezone: payload.timezone || null,
		browser: payload.browser || null,
		browserVersion: payload.browserVersion || null,
		os: payload.os || null,
		osVersion: payload.osVersion || null,
		deviceType: payload.deviceType || null,
		isPwa: payload.isPwa || false,
		country: geoData.country,
		region: geoData.region,
		city: geoData.city
	};

	if (sessionExists) {
		const s = existingSession[0];
		if (s.expiresAt < now || s.websiteId !== site.id) {
			const [newSession] = await db
				.insert(analyticsSession)
				.values({
					...sessionData,
					id: undefined
				})
				.returning();
			sessionId = newSession.id;
			checkTrafficSpike(site.id, site.notifications as { trafficSpike: { enabled: boolean; threshold: number; windowSeconds: number } } | undefined, now).catch(console.error);
		} else {
			const updateData: Record<string, unknown> = { expiresAt: sessionExpiry, lastActivityAt: now };
			if (!s.country && geoData.country) {
				updateData.country = geoData.country;
				updateData.region = geoData.region;
				updateData.city = geoData.city;
			}
			if (utm.source && !s.utmSource) {
				updateData.utmSource = utm.source;
			}
			if (utm.medium && !s.utmMedium) {
				updateData.utmMedium = utm.medium;
			}
			if (utm.campaign && !s.utmCampaign) {
				updateData.utmCampaign = utm.campaign;
			}
			if (!s.referrer && payload.referrer) {
				updateData.referrer = payload.referrer;
			}
			await db.update(analyticsSession).set(updateData).where(eq(analyticsSession.id, sessionId));
		}
	} else {
		try {
			const [newSession] = await db.insert(analyticsSession).values(sessionData).returning();
			sessionId = newSession.id;
			checkTrafficSpike(site.id, site.notifications as { trafficSpike: { enabled: boolean; threshold: number; windowSeconds: number } } | undefined, now).catch(console.error);
		} catch (insertError: unknown) {
			const errorMsg = String(insertError);
			if (errorMsg.includes('duplicate') || errorMsg.includes('unique') || errorMsg.includes('23505')) {
				await db
					.update(analyticsSession)
					.set({ expiresAt: sessionExpiry, lastActivityAt: now })
					.where(and(eq(analyticsSession.id, sessionId), eq(analyticsSession.websiteId, site.id)));
			} else {
				throw insertError;
			}
		}
	}

	if (payload.type === 'heartbeat') {
		return json({ success: true }, { status: 200, headers: corsHeaders });
	}

	if (payload.type === 'pageview') {
		await db.insert(pageview).values({
			sessionId,
			websiteId: site.id,
			url: payload.href,
			pathname: extractPathname(payload.href),
			referrer: payload.referrer || null,
			title: payload.title || null,
			viewportWidth: payload.viewport?.width || null,
			viewportHeight: payload.viewport?.height || null,
			timestamp: now
		});
	} else if (payload.type === 'payment') {
		await db.insert(payment).values({
			websiteId: site.id,
			visitorId: payload.visitorId,
			sessionId,
			amount: payload.amount || 0,
			currency: payload.currency || 'USD',
			transactionId: payload.transactionId || null,
			timestamp: now
		});

		const [existingVisitorRecord] = await db
			.select({ isCustomer: visitor.isCustomer })
			.from(visitor)
			.where(and(eq(visitor.id, payload.visitorId), eq(visitor.websiteId, site.id)))
			.limit(1);

		if (existingVisitorRecord && !existingVisitorRecord.isCustomer) {
			await db
				.update(visitor)
				.set({ isCustomer: true })
				.where(and(eq(visitor.id, payload.visitorId), eq(visitor.websiteId, site.id)));
		}
	} else {
		await db.insert(analyticsEvent).values({
			sessionId,
			websiteId: site.id,
			type: payload.type,
			name: payload.name || null,
			data: payload.data || null,
			timestamp: now
		});
	}

	return json({ success: true }, { status: 200, headers: corsHeaders });
};

export const OPTIONS: RequestHandler = async ({ request }) => {
	const requestOrigin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(requestOrigin);
	return new Response(null, { status: 204, headers: corsHeaders });
};
