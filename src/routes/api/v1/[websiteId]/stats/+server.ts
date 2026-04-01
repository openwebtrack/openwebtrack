import { isValidUUID, parseDateRange, parseGranularity, getDayKey, getHourKey, getWeekKey, getMonthKey } from '$lib/server/utils';
import { apiKey, pageview, analyticsSession, visitor, website } from '$lib/server/db/schema';
import { statsQuerySchema, validateQuery } from '$lib/server/validation';
import { and, count, eq, gte, lte, sql, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { createHash } from 'crypto';
import db from '$lib/server/db';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const authenticateRequest = async (authorization: string | null, websiteId: string) => {
	if (!authorization?.startsWith('Bearer ')) return null;
	const raw = authorization.slice(7).trim();
	if (!raw.startsWith('owt_')) return null;

	const keyHash = createHash('sha256').update(raw).digest('hex');

	const [key] = await db
		.select({ id: apiKey.id })
		.from(apiKey)
		.where(and(eq(apiKey.keyHash, keyHash), eq(apiKey.websiteId, websiteId)))
		.limit(1);

	if (!key) return null;

	// Update last used timestamp (fire and forget)
	db.update(apiKey)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiKey.id, key.id))
		.catch(() => {});

	return key;
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: RequestHandler = async ({ params, request, url }) => {
	if (!isValidUUID(params.websiteId)) {
		return json({ error: 'Invalid website ID' }, { status: 400, headers: CORS_HEADERS });
	}

	const key = await authenticateRequest(request.headers.get('authorization'), params.websiteId);
	if (!key) {
		return json({ error: 'Invalid or missing API key' }, { status: 401, headers: CORS_HEADERS });
	}

	const [site] = await db.select({ timezone: website.timezone }).from(website).where(eq(website.id, params.websiteId)).limit(1);

	if (!site) {
		return json({ error: 'Website not found' }, { status: 404, headers: CORS_HEADERS });
	}

	const queryResult = validateQuery(statsQuerySchema, url.searchParams);
	if (!queryResult.success) {
		return json({ error: queryResult.error }, { status: 400, headers: CORS_HEADERS });
	}

	const query = queryResult.data;
	const dateRange = parseDateRange(query.startDate ?? null, query.endDate ?? null);
	const granularity = parseGranularity(query.granularity ?? null);

	const pageviewWhere = and(eq(pageview.websiteId, params.websiteId), gte(pageview.timestamp, dateRange.start), lte(pageview.timestamp, dateRange.end));

	const sessionWhere = and(eq(analyticsSession.websiteId, params.websiteId), gte(analyticsSession.startedAt, dateRange.start), lte(analyticsSession.startedAt, dateRange.end));

	const [pvCount, sessionCount, visitorCount, bouncedSessions, topPages, topReferrers, pvTimeSeries] = await Promise.all([
		db.select({ count: count() }).from(pageview).where(pageviewWhere),

		db.select({ count: count() }).from(analyticsSession).where(sessionWhere),

		db
			.select({ count: sql<number>`COUNT(DISTINCT ${visitor.id})` })
			.from(visitor)
			.where(and(eq(visitor.websiteId, params.websiteId), gte(visitor.lastSeen, dateRange.start), lte(visitor.lastSeen, dateRange.end))),

		// Sessions with exactly 1 pageview (bounces)
		db.select({ count: count() }).from(
			db
				.select({ sessionId: pageview.sessionId })
				.from(pageview)
				.where(pageviewWhere)
				.groupBy(pageview.sessionId)
				.having(sql`count(*) = 1`)
				.as('bounced')
		),

		db.select({ pathname: pageview.pathname, views: count() }).from(pageview).where(pageviewWhere).groupBy(pageview.pathname).orderBy(desc(count())).limit(10),

		db
			.select({ referrer: analyticsSession.referrer, sessions: count() })
			.from(analyticsSession)
			.where(and(sessionWhere, sql`${analyticsSession.referrer} IS NOT NULL`, sql`${analyticsSession.referrer} != ''`))
			.groupBy(analyticsSession.referrer)
			.orderBy(desc(count()))
			.limit(10),

		db.select({ timestamp: pageview.timestamp }).from(pageview).where(pageviewWhere).orderBy(pageview.timestamp).limit(100000)
	]);

	// Build time series
	const tsMap = new Map<string, number>();
	for (const row of pvTimeSeries) {
		const date = new Date(row.timestamp);
		let dateKey: string;
		if (granularity === 'hourly') dateKey = getHourKey(date, site.timezone);
		else if (granularity === 'weekly') dateKey = getWeekKey(date, site.timezone);
		else if (granularity === 'monthly') dateKey = getMonthKey(date, site.timezone);
		else dateKey = getDayKey(date, site.timezone);
		tsMap.set(dateKey, (tsMap.get(dateKey) ?? 0) + 1);
	}

	const timeSeries = Array.from(tsMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, pageviews]) => ({ date, pageviews }));

	const totalPageviews = pvCount[0]?.count ?? 0;
	const totalSessions = sessionCount[0]?.count ?? 0;
	const totalVisitors = Number(visitorCount[0]?.count ?? 0);
	const bounced = bouncedSessions[0]?.count ?? 0;
	const bounceRate = totalSessions > 0 ? Math.round((bounced / totalSessions) * 100) : 0;

	return json(
		{
			summary: {
				pageviews: totalPageviews,
				sessions: totalSessions,
				visitors: totalVisitors,
				bounceRate,
				dateRange: {
					start: dateRange.start.toISOString(),
					end: dateRange.end.toISOString()
				}
			},
			timeSeries,
			topPages: topPages.map((p) => ({ pathname: p.pathname, views: p.views })),
			topReferrers: topReferrers.filter((r) => r.referrer != null).map((r) => ({ referrer: r.referrer as string, sessions: r.sessions }))
		},
		{ headers: CORS_HEADERS }
	);
};
