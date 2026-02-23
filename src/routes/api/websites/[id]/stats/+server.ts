import { website, visitor, analyticsSession, pageview, analyticsEvent, teamMember } from '$lib/server/db/schema';
import { eq, and, count, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	parseDateRange,
	parseGranularity,
	parseFilters,
	buildFilterConditions,
	categorizeChannel,
	isInternalReferrer,
	getWeekKey,
	getMonthKey,
	getHourKey,
	getDayKey,
	getDateInTimezone,
	checkWebsiteAccess,
	isValidUUID
} from '$lib/server/utils';
import { statsQuerySchema, validateQuery } from '$lib/server/validation';
import type { Granularity } from '$lib/server/types';
import { DEFAULT_QUERY_LIMITS } from '$lib/constants';

interface TimeSeriesPoint {
	date: string;
	visitors: number;
	pageviews: number;
}

const calculateAvgSessionDuration = async (websiteId: string, start: Date, end: Date): Promise<number> => {
	try {
		const sessionDurations = await db
			.select({
				sessionId: pageview.sessionId,
				minTime: sql<Date>`MIN(${pageview.timestamp})`.as('min_time'),
				maxTime: sql<Date>`MAX(${pageview.timestamp})`.as('max_time')
			})
			.from(pageview)
			.where(and(eq(pageview.websiteId, websiteId), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
			.groupBy(pageview.sessionId)
			.having(sql`COUNT(*) > 1`)
			.limit(1000);

		if (sessionDurations.length === 0) return 0;

		let totalDurationMs = 0;
		for (const session of sessionDurations) {
			const duration = new Date(session.maxTime).getTime() - new Date(session.minTime).getTime();
			totalDurationMs += duration;
		}

		return Math.round(totalDurationMs / sessionDurations.length);
	} catch (e) {
		console.error('Error calculating session duration:', e);
		return 0;
	}
};

const calculateEntryPages = async (websiteId: string, start: Date, end: Date): Promise<{ pathname: string; count: bigint }[]> => {
	try {
		const sessionFirstPageviews = await db
			.select({
				sessionId: pageview.sessionId,
				minTime: sql<Date>`MIN(${pageview.timestamp})`.as('min_time')
			})
			.from(pageview)
			.where(and(eq(pageview.websiteId, websiteId), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
			.groupBy(pageview.sessionId)
			.limit(DEFAULT_QUERY_LIMITS.sessions);

		if (sessionFirstPageviews.length === 0) return [];

		const sessionIds = sessionFirstPageviews.map((s) => s.sessionId);
		const firstPageviewMap = new Map(sessionFirstPageviews.map((s) => [s.sessionId, s.minTime]));

		const pageviews = await db.select({ sessionId: pageview.sessionId, pathname: pageview.pathname, timestamp: pageview.timestamp }).from(pageview).where(inArray(pageview.sessionId, sessionIds));

		const entryPageCounts = new Map<string, number>();
		for (const pv of pageviews) {
			const firstTime = firstPageviewMap.get(pv.sessionId);
			if (firstTime && new Date(pv.timestamp).getTime() === new Date(firstTime).getTime()) {
				entryPageCounts.set(pv.pathname, (entryPageCounts.get(pv.pathname) || 0) + 1);
			}
		}

		return Array.from(entryPageCounts.entries())
			.map(([pathname, count]) => ({ pathname, count: BigInt(count) }))
			.sort((a, b) => Number(b.count) - Number(a.count))
			.slice(0, 10);
	} catch (e) {
		console.error('Error fetching entry pages:', e);
		return [];
	}
};

const calculateTimeSeries = async (
	websiteId: string,
	start: Date,
	end: Date,
	basePageviewWhere: ReturnType<typeof and>,
	granularity: Granularity,
	timezone: string
): Promise<{ pageviewMap: Map<string, number>; visitorMap: Map<string, number> }> => {
	const [pageviews, visitors] = await Promise.all([
		db.select({ timestamp: pageview.timestamp }).from(pageview).where(basePageviewWhere).limit(DEFAULT_QUERY_LIMITS.pageviews),
		db
			.select({ id: visitor.id, lastSeen: visitor.lastSeen })
			.from(visitor)
			.where(and(eq(visitor.websiteId, websiteId), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
			.limit(DEFAULT_QUERY_LIMITS.visitors)
	]);

	const pageviewMap = new Map<string, number>();
	for (const pv of pageviews) {
		let dateStr: string;
		if (granularity === 'hourly') {
			dateStr = getHourKey(pv.timestamp, timezone);
		} else if (granularity === 'weekly') {
			dateStr = getWeekKey(pv.timestamp, timezone);
		} else if (granularity === 'monthly') {
			dateStr = getMonthKey(pv.timestamp, timezone);
		} else {
			dateStr = getDayKey(pv.timestamp, timezone);
		}
		pageviewMap.set(dateStr, (pageviewMap.get(dateStr) || 0) + 1);
	}

	const visitorByDate = new Map<string, Set<string>>();
	for (const v of visitors) {
		let dateStr: string;
		if (granularity === 'weekly') {
			dateStr = getWeekKey(v.lastSeen, timezone);
		} else if (granularity === 'monthly') {
			dateStr = getMonthKey(v.lastSeen, timezone);
		} else {
			dateStr = getDayKey(v.lastSeen, timezone);
		}
		if (!visitorByDate.has(dateStr)) {
			visitorByDate.set(dateStr, new Set());
		}
		visitorByDate.get(dateStr)!.add(v.id);
	}

	const visitorMap = new Map<string, number>();
	for (const [date, visitorSet] of visitorByDate) {
		visitorMap.set(date, visitorSet.size);
	}

	return { pageviewMap, visitorMap };
};

const buildTimeSeries = (pageviewMap: Map<string, number>, visitorMap: Map<string, number>, start: Date, end: Date, granularity: Granularity, timezone: string): TimeSeriesPoint[] => {
	const timeSeries: TimeSeriesPoint[] = [];

	if (granularity === 'hourly') {
		const startTime = start.getTime();
		const endTime = end.getTime();
		const hourMs = 60 * 60 * 1000;

		for (let current = startTime; current <= endTime; current += hourMs) {
			const currentDate = new Date(current);
			const dateStr = getHourKey(currentDate, timezone);
			timeSeries.push({
				date: dateStr,
				visitors: visitorMap.get(dateStr) || 0,
				pageviews: pageviewMap.get(dateStr) || 0
			});
		}
	} else if (granularity === 'daily') {
		const startTime = start.getTime();
		const endTime = end.getTime();
		const numDays = Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000));

		for (let i = 0; i <= numDays; i++) {
			const currentDate = new Date(startTime + i * 24 * 60 * 60 * 1000);
			const dateStr = getDayKey(currentDate, timezone);
			timeSeries.push({
				date: dateStr,
				visitors: visitorMap.get(dateStr) || 0,
				pageviews: pageviewMap.get(dateStr) || 0
			});
		}
	} else if (granularity === 'weekly') {
		const { year, month, day } = getDateInTimezone(start, timezone);
		const current = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
		const dayOfWeek = current.getUTCDay();
		const diff = current.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
		current.setUTCDate(diff);

		while (current <= end) {
			const dateStr = current.toISOString().split('T')[0];
			timeSeries.push({
				date: dateStr,
				visitors: visitorMap.get(dateStr) || 0,
				pageviews: pageviewMap.get(dateStr) || 0
			});
			current.setUTCDate(current.getUTCDate() + 7);
		}
	} else if (granularity === 'monthly') {
		const { year, month } = getDateInTimezone(start, timezone);
		const current = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

		while (current <= end) {
			const dateStr = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-01`;
			timeSeries.push({
				date: dateStr,
				visitors: visitorMap.get(dateStr) || 0,
				pageviews: pageviewMap.get(dateStr) || 0
			});
			current.setUTCMonth(current.getUTCMonth() + 1);
		}
	}

	return timeSeries;
};

export const GET: RequestHandler = async ({ locals, params, url }) => {
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

	const site = access.site;

	const queryValidation = validateQuery(statsQuerySchema, url.searchParams);
	if (!queryValidation.success) {
		return json({ error: queryValidation.error, errors: queryValidation.errors }, { status: 400 });
	}

	const { start, end } = parseDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'), site.timezone);
	const granularity = parseGranularity(queryValidation.data.granularity || null);
	const filters = parseFilters(url.searchParams.get('filters'));
	const { sessionConditions, pageviewConditions, eventConditions } = buildFilterConditions(filters);

	const basePageviewWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end), ...pageviewConditions);
	const baseSessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, start), lte(analyticsSession.startedAt, end), ...sessionConditions);
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	const [
		visitorStats,
		pageviewStats,
		sessionStats,
		onlineCount,
		topPages,
		exitLinks,
		topReferrers,
		sessionReferrers,
		customEvents,
		recentSessions,
		deviceStats,
		browserStats,
		osStats,
		deviceTypeStats,
		countryStats,
		regionStats,
		cityStats
	] = await Promise.all([
		db
			.select({ count: count() })
			.from(visitor)
			.where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
			.then((r) => r[0]),
		db
			.select({ count: count() })
			.from(pageview)
			.where(basePageviewWhere)
			.then((r) => r[0]),
		db
			.select({ count: count() })
			.from(analyticsSession)
			.where(baseSessionWhere)
			.then((r) => r[0]),
		db
			.select({ count: count() })
			.from(analyticsSession)
			.where(and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.lastActivityAt, fiveMinutesAgo), ...sessionConditions))
			.then((r) => r[0]),
		db.select({ pathname: pageview.pathname, count: count() }).from(pageview).where(basePageviewWhere).groupBy(pageview.pathname).orderBy(desc(count())).limit(10),
		db
			.select({ name: analyticsEvent.name, data: analyticsEvent.data, count: count() })
			.from(analyticsEvent)
			.where(
				and(
					eq(analyticsEvent.websiteId, site.id),
					eq(analyticsEvent.type, 'custom'),
					eq(analyticsEvent.name, 'external_link'),
					gte(analyticsEvent.timestamp, start),
					lte(analyticsEvent.timestamp, end),
					...eventConditions
				)
			)
			.groupBy(analyticsEvent.name, analyticsEvent.data)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ referrer: pageview.referrer, count: count() })
			.from(pageview)
			.where(and(basePageviewWhere, sql`${pageview.referrer} IS NOT NULL`, sql`${pageview.referrer} != ''`))
			.groupBy(pageview.referrer)
			.orderBy(desc(count()))
			.limit(20),
		db
			.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, count: count() })
			.from(analyticsSession)
			.where(baseSessionWhere)
			.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium)
			.orderBy(desc(count()))
			.limit(50),
		db
			.select({ type: analyticsEvent.type, name: analyticsEvent.name, count: count() })
			.from(analyticsEvent)
			.where(and(eq(analyticsEvent.websiteId, site.id), gte(analyticsEvent.timestamp, start), lte(analyticsEvent.timestamp, end), ...eventConditions))
			.groupBy(analyticsEvent.type, analyticsEvent.name)
			.orderBy(desc(count()))
			.limit(20),
		db
			.select({
				id: analyticsSession.id,
				startedAt: analyticsSession.startedAt,
				referrer: analyticsSession.referrer,
				utmSource: analyticsSession.utmSource,
				screenWidth: analyticsSession.screenWidth,
				screenHeight: analyticsSession.screenHeight,
				language: analyticsSession.language
			})
			.from(analyticsSession)
			.where(baseSessionWhere)
			.orderBy(desc(analyticsSession.startedAt))
			.limit(50),
		db
			.select({ screenWidth: analyticsSession.screenWidth, screenHeight: analyticsSession.screenHeight, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.screenWidth} IS NOT NULL`))
			.groupBy(analyticsSession.screenWidth, analyticsSession.screenHeight)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ browser: analyticsSession.browser, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.browser} IS NOT NULL AND ${analyticsSession.browser} != ''`))
			.groupBy(analyticsSession.browser)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ os: analyticsSession.os, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.os} IS NOT NULL AND ${analyticsSession.os} != ''`))
			.groupBy(analyticsSession.os)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ deviceType: analyticsSession.deviceType, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.deviceType} IS NOT NULL AND ${analyticsSession.deviceType} != ''`))
			.groupBy(analyticsSession.deviceType)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ country: analyticsSession.country, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.country} IS NOT NULL AND ${analyticsSession.country} != ''`))
			.groupBy(analyticsSession.country)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ region: analyticsSession.region, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.region} IS NOT NULL AND ${analyticsSession.region} != ''`))
			.groupBy(analyticsSession.region)
			.orderBy(desc(count()))
			.limit(10),
		db
			.select({ city: analyticsSession.city, count: count() })
			.from(analyticsSession)
			.where(and(baseSessionWhere, sql`${analyticsSession.city} IS NOT NULL AND ${analyticsSession.city} != ''`))
			.groupBy(analyticsSession.city)
			.orderBy(desc(count()))
			.limit(10)
	]);

	const [avgSessionDurationMs, entryPages, { pageviewMap, visitorMap }] = await Promise.all([
		calculateAvgSessionDuration(site.id, start, end),
		calculateEntryPages(site.id, start, end),
		calculateTimeSeries(site.id, start, end, basePageviewWhere, granularity, site.timezone)
	]);

	const timeSeries = buildTimeSeries(pageviewMap, visitorMap, start, end, granularity, site.timezone);

	const filteredReferrers = topReferrers.filter((r) => !isInternalReferrer(r.referrer)).slice(0, 10);

	const channelCounts = new Map<string, number>();
	for (const session of sessionReferrers) {
		const channel = categorizeChannel(session.referrer, session.utmSource, session.utmMedium);
		channelCounts.set(channel, (channelCounts.get(channel) || 0) + Number(session.count));
	}

	const data = Array.from(channelCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([label, value]) => ({ label, value }));

	return json({
		website: site,
		stats: {
			visitors: visitorStats?.count || 0,
			pageviews: pageviewStats?.count || 0,
			sessions: sessionStats?.count || 0,
			avgSessionDuration: avgSessionDurationMs,
			online: onlineCount?.count || 0
		},
		topPages: topPages.map((p) => ({ label: p.pathname, value: p.count })),
		entryPages: entryPages.map((p) => ({ label: p.pathname, value: Number(p.count) })),
		exitLinks: exitLinks.map((e) => {
			const data = e.data as Record<string, unknown> | null;
			return {
				label: (data?.url as string) || (data?.text as string) || 'External link',
				value: e.count
			};
		}),
		topReferrers: filteredReferrers.map((r) => {
			let label = r.referrer || 'Direct';
			try {
				const url = new URL(r.referrer || '');
				label = url.hostname.replace(/^www\./, '');
			} catch {}
			return { label, value: r.count };
		}),
		channelData: data,
		customEvents: customEvents.map((e) => ({ type: e.type, name: e.name, value: e.count })),
		recentSessions,
		deviceStats: deviceStats.map((d) => ({ label: `${d.screenWidth}x${d.screenHeight}`, value: d.count })),
		browserStats: browserStats.map((b) => ({ label: b.browser || 'Unknown', value: b.count })),
		osStats: osStats.map((o) => ({ label: o.os || 'Unknown', value: o.count })),
		deviceTypeStats: deviceTypeStats.map((d) => ({ label: d.deviceType || 'Unknown', value: d.count })),
		countryStats: countryStats.map((c) => ({ label: c.country || 'Unknown', value: c.count })),
		regionStats: regionStats.map((r) => ({ label: r.region || 'Unknown', value: r.count })),
		cityStats: cityStats.map((c) => ({ label: c.city || 'Unknown', value: c.count })),
		timeSeries,
		timezone: site.timezone,
		dateRange: {
			start: start.toISOString(),
			end: end.toISOString()
		}
	});
};
