import { website, visitor, analyticsSession, pageview, analyticsEvent, payment } from '$lib/server/db/schema';
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
import { DEFAULT_QUERY_LIMITS } from '@/utils/constants';

interface TimeSeriesPoint {
	date: string;
	visitors: number;
	pageviews: number;
	revenue?: number;
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

const calculateRevenueTimeSeries = async (websiteId: string, start: Date, end: Date, granularity: Granularity, timezone: string): Promise<Map<string, number>> => {
	const payments = await db
		.select({ timestamp: payment.timestamp, amount: payment.amount })
		.from(payment)
		.where(and(eq(payment.websiteId, websiteId), gte(payment.timestamp, start), lte(payment.timestamp, end)))
		.limit(DEFAULT_QUERY_LIMITS.pageviews);

	const revenueMap = new Map<string, number>();
	for (const p of payments) {
		let dateStr: string;
		if (granularity === 'hourly') {
			dateStr = getHourKey(p.timestamp, timezone);
		} else if (granularity === 'weekly') {
			dateStr = getWeekKey(p.timestamp, timezone);
		} else if (granularity === 'monthly') {
			dateStr = getMonthKey(p.timestamp, timezone);
		} else {
			dateStr = getDayKey(p.timestamp, timezone);
		}
		revenueMap.set(dateStr, (revenueMap.get(dateStr) || 0) + Number(p.amount));
	}

	return revenueMap;
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
	const basePaymentWhere = and(eq(payment.websiteId, site.id), gte(payment.timestamp, start), lte(payment.timestamp, end));
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
		campaignData,
		customEvents,
		recentSessions,
		deviceStats,
		browserStats,
		osStats,
		deviceTypeStats,
		countryStats,
		regionStats,
		cityStats,
		totalRevenue,
		customerCount,
		revenueByCountry,
		revenueByRegion,
		revenueByCity,
		revenueByOs,
		revenueByBrowser,
		revenueByDeviceType,
		revenueByChannel,
		revenueByHostname,
		revenueByPage
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
			.select({
				utmSource: analyticsSession.utmSource,
				utmMedium: analyticsSession.utmMedium,
				utmCampaign: analyticsSession.utmCampaign,
				count: count()
			})
			.from(analyticsSession)
			.where(
				and(
					baseSessionWhere,
					sql`(${analyticsSession.utmSource} IS NOT NULL AND ${analyticsSession.utmSource} != '') OR (${analyticsSession.utmMedium} IS NOT NULL AND ${analyticsSession.utmMedium} != '') OR (${analyticsSession.utmCampaign} IS NOT NULL AND ${analyticsSession.utmCampaign} != '')`
				)
			)
			.groupBy(analyticsSession.utmSource, analyticsSession.utmMedium, analyticsSession.utmCampaign)
			.orderBy(desc(count()))
			.limit(20),
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
			.limit(10),
		db
			.select({ totalRevenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.where(basePaymentWhere)
			.then((r) => r[0]),
		db
			.select({ count: count() })
			.from(visitor)
			.where(and(eq(visitor.websiteId, site.id), eq(visitor.isCustomer, true), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
			.then((r) => r[0]),
		db
			.select({ country: analyticsSession.country, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.country} IS NOT NULL`))
			.groupBy(analyticsSession.country)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ region: analyticsSession.region, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.region} IS NOT NULL`))
			.groupBy(analyticsSession.region)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ city: analyticsSession.city, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.city} IS NOT NULL`))
			.groupBy(analyticsSession.city)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ os: analyticsSession.os, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.os} IS NOT NULL`))
			.groupBy(analyticsSession.os)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ browser: analyticsSession.browser, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.browser} IS NOT NULL`))
			.groupBy(analyticsSession.browser)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ deviceType: analyticsSession.deviceType, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(and(basePaymentWhere, sql`${analyticsSession.deviceType} IS NOT NULL`))
			.groupBy(analyticsSession.deviceType)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.where(basePaymentWhere)
			.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(20),
		db
			.select({ full_url: sql<string>`${pageview.url}::text`.as('full_url'), revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.innerJoin(pageview, and(eq(pageview.sessionId, analyticsSession.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
			.where(eq(payment.websiteId, site.id))
			.groupBy(sql<string>`${pageview.url}::text`)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10),
		db
			.select({ pathname: pageview.pathname, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` })
			.from(payment)
			.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
			.innerJoin(pageview, and(eq(pageview.sessionId, analyticsSession.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
			.where(and(eq(payment.websiteId, site.id), sql`${pageview.pathname} IS NOT NULL`))
			.groupBy(pageview.pathname)
			.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`))
			.limit(10)
	]);

	const [avgSessionDurationMs, entryPages, { pageviewMap, visitorMap }, revenueMap] = await Promise.all([
		calculateAvgSessionDuration(site.id, start, end),
		calculateEntryPages(site.id, start, end),
		calculateTimeSeries(site.id, start, end, basePageviewWhere, granularity, site.timezone),
		calculateRevenueTimeSeries(site.id, start, end, granularity, site.timezone)
	]);

	const timeSeries = buildTimeSeries(pageviewMap, visitorMap, start, end, granularity, site.timezone).map((point) => ({
		...point,
		revenue: revenueMap.get(point.date) || 0
	}));

	const filteredReferrers = topReferrers.filter((r) => !isInternalReferrer(r.referrer)).slice(0, 10);

	const channelCounts = new Map<string, number>();
	for (const session of sessionReferrers) {
		const channel = categorizeChannel(session.referrer, session.utmSource, session.utmMedium);
		channelCounts.set(channel, (channelCounts.get(channel) || 0) + Number(session.count));
	}

	const data = Array.from(channelCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([label, value]) => ({ label, value }));

	const revenueChannelData: { label: string; value: number }[] = [];
	const channelRevenueMap = new Map<string, number>();
	for (const item of revenueByChannel) {
		const channel = categorizeChannel(item.referrer, item.utmSource, item.utmMedium);
		channelRevenueMap.set(channel, (channelRevenueMap.get(channel) || 0) + Number(item.revenue));
	}
	Array.from(channelRevenueMap.entries())
		.sort((a, b) => b[1] - a[1])
		.forEach(([label, value]) => {
			revenueChannelData.push({ label, value });
		});

	return json({
		website: site,
		stats: {
			visitors: visitorStats?.count || 0,
			pageviews: pageviewStats?.count || 0,
			sessions: sessionStats?.count || 0,
			avgSessionDuration: avgSessionDurationMs,
			online: onlineCount?.count || 0,
			revenue: totalRevenue?.totalRevenue || 0,
			customers: customerCount?.count || 0
		},
		topPages: topPages.map((p) => ({ label: p.pathname || '/', value: p.count })),
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
		revenueByChannel: revenueChannelData,
		campaignData: campaignData.map((c) => {
			const parts: string[] = [];
			if (c.utmSource) parts.push(`utm_source=${c.utmSource}`);
			if (c.utmMedium) parts.push(`utm_medium=${c.utmMedium}`);
			if (c.utmCampaign) parts.push(`utm_campaign=${c.utmCampaign}`);
			return { label: parts.length > 0 ? `?${parts.join('&')}` : 'Unknown', value: c.count };
		}),
		customEvents: customEvents.map((e) => ({ type: e.type, name: e.name, value: e.count })),
		recentSessions,
		deviceStats: deviceStats.map((d) => ({ label: `${d.screenWidth}x${d.screenHeight}`, value: d.count })),
		browserStats: browserStats.map((b) => ({ label: b.browser || 'Unknown', value: b.count })),
		osStats: osStats.map((o) => ({ label: o.os || 'Unknown', value: o.count })),
		deviceTypeStats: deviceTypeStats.map((d) => ({ label: d.deviceType || 'Unknown', value: d.count })),
		countryStats: countryStats.map((c) => ({ label: c.country || 'Unknown', value: c.count })),
		regionStats: regionStats.map((r) => ({ label: r.region || 'Unknown', value: r.count })),
		cityStats: cityStats.map((c) => ({ label: c.city || 'Unknown', value: c.count })),
		revenueByCountry: revenueByCountry.map((c) => ({ label: c.country || 'Unknown', value: Number(c.revenue) })),
		revenueByRegion: revenueByRegion.map((r) => ({ label: r.region || 'Unknown', value: Number(r.revenue) })),
		revenueByCity: revenueByCity.map((c) => ({ label: c.city || 'Unknown', value: Number(c.revenue) })),
		revenueByOs: revenueByOs.map((o) => ({ label: o.os || 'Unknown', value: Number(o.revenue) })),
		revenueByBrowser: revenueByBrowser.map((b) => ({ label: b.browser || 'Unknown', value: Number(b.revenue) })),
		revenueByDeviceType: revenueByDeviceType.map((d) => ({ label: d.deviceType || 'Unknown', value: Number(d.revenue) })),
		revenueByHostname: revenueByHostname.map((h) => {
			let label = h.full_url || site.domain;
			try {
				const url = new URL(h.full_url || '');
				label = url.hostname.replace(/^www\./, '');
			} catch (e) {
				console.error('Failed to parse URL:', h.full_url, e);
			}
			return { label, value: Number(h.revenue), icon: `https://icons.duckduckgo.com/ip3/${label}.ico` };
		}),
		revenueByPage: revenueByPage.map((p) => ({ label: p.pathname || '/', value: Number(p.revenue) })),
		timeSeries,
		timezone: site.timezone,
		dateRange: {
			start: start.toISOString(),
			end: end.toISOString()
		}
	});
};
