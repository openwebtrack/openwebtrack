import { SESSION_EXPIRY_MINUTES, GEO_CACHE_TTL_MS, GEO_CACHE_MAX_SIZE, MAX_STRING_LENGTHS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '$lib/constants';
import { website, visitor, analyticsSession, pageview, analyticsEvent } from '$lib/server/db/schema';
import { sanitizeString, extractPathname, extractUtmParams } from '$lib/server/utils';
import { generateVisitorName, generateAvatarUrl } from '$lib/server/visitor-utils';
import { trackingPayloadSchema, validateBody } from '$lib/server/validation';
import type { TrackingPayload, GeoData } from '$lib/server/types';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import db from '$lib/server/db';
import axios from 'axios';

interface GeoCacheEntry {
	data: GeoData;
	expiresAt: number;
	lastAccessed: number;
}

interface RateLimitEntry {
	count: number;
	windowStart: number;
}

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

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
	}

	const validation = validateBody(trackingPayloadSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400, headers: CORS_HEADERS });
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
		data: rawPayload.data
	};

	let socketIP: string | undefined;
	try {
		socketIP = getClientAddress();
	} catch {}

	const rateLimitKey = `${payload.websiteId}:${socketIP || 'unknown'}`;
	if (!checkRateLimit(rateLimitKey)) {
		return json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS_HEADERS });
	}

	const [site] = await db.select().from(website).where(eq(website.id, payload.websiteId)).limit(1);

	if (!site) {
		return json({ error: 'Website not found' }, { status: 404, headers: CORS_HEADERS });
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
		return json({ error: 'Domain mismatch' }, { status: 403, headers: CORS_HEADERS });
	}

	const now = new Date();
	const sessionExpiry = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);

	const clientIP = getClientIP(request, socketIP);

	const geoData = await getGeoData(clientIP);

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
		return json({ success: true }, { status: 200, headers: CORS_HEADERS });
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

	return json({ success: true }, { status: 200, headers: CORS_HEADERS });
};

export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204, headers: CORS_HEADERS });
