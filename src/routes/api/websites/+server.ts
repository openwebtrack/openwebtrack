import { eq, count, desc, and, gte, inArray } from 'drizzle-orm';
import { website, visitor } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import db from '$lib/server/db';
import { websiteCreateSchema, validateBody } from '$lib/server/validation';

const sanitizeDomain = (domain: string): string =>
	domain
		.toLowerCase()
		.trim()
		.replace(/^https?:\/\//, '')
		.replace(/^www\./, '')
		.replace(/\/.*$/, '')
		.substring(0, 255);

const isLocalDomain = (domain: string): boolean => {
	const hostname = domain.split(':')[0];

	const localAddresses = ['localhost', '127.0.0.1', '::1'];
	if (localAddresses.includes(hostname)) return true;
	if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) return true;
	if (/^127(\.\d+){0,3}$/.test(hostname)) return true;
	return false;
};

const isValidDomain = (domain: string): boolean => {
	if (!domain || domain.length < 1 || domain.length > 255) return false;

	if (dev && isLocalDomain(domain)) return true;

	const hostname = domain.split(':')[0];
	const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
	return domainRegex.test(hostname);
};

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const withStats = url.searchParams.get('stats') === 'true';

	const websites = await db.select().from(website).where(eq(website.userId, locals.user.id)).orderBy(desc(website.createdAt));

	if (withStats) {
		const now = new Date();
		const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const websiteIds = websites.map((s) => s.id);
		const visitorCounts =
			websiteIds.length > 0
				? await db
						.select({ websiteId: visitor.websiteId, count: count() })
						.from(visitor)
						.where(and(inArray(visitor.websiteId, websiteIds), gte(visitor.lastSeen, last24h)))
						.groupBy(visitor.websiteId)
				: [];

		const countMap = new Map(visitorCounts.map((v) => [v.websiteId, v.count]));

		const websitesWithStats = websites.map((site) => ({
			...site,
			visitors24h: countMap.get(site.id) || 0
		}));

		return json(websitesWithStats);
	}

	return json(websites);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const validation = validateBody(websiteCreateSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	}

	const { domain, timezone = 'UTC' } = validation.data;

	const [existing] = await db.select().from(website).where(eq(website.domain, domain)).limit(1);

	if (existing) {
		throw error(409, 'Domain already registered');
	}

	const [newWebsite] = await db
		.insert(website)
		.values({
			domain,
			userId: locals.user.id,
			timezone
		})
		.returning();

	return json(newWebsite, { status: 201 });
};
