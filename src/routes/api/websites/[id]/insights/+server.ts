import { visitor, analyticsSession, pageview, payment } from '$lib/server/db/schema';
import { eq, and, count, desc, sql, gte, lte } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { parseDateRange, checkWebsiteAccess, isValidUUID, categorizeChannel, isInternalReferrer } from '$lib/server/utils';
import { generateInsights, insightsEnabled } from '$lib/server/insights';

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

	if (!insightsEnabled) {
		return json(null, { status: 200 });
	}

	const site = access.site;
	const { start, end } = parseDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'), site.timezone);

	const basePageviewWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end));
	const baseSessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, start), lte(analyticsSession.startedAt, end));
	const basePaymentWhere = and(eq(payment.websiteId, site.id), gte(payment.timestamp, start), lte(payment.timestamp, end));

	const [visitorStats, pageviewStats, sessionStats, totalRevenue, customerCount, topPages, topReferrersRaw, sessionReferrers, revenueByChannelRaw, countryStats] = await Promise.all([
		db.select({ count: count() }).from(visitor).where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end))).then((r) => r[0]),
		db.select({ count: count() }).from(pageview).where(basePageviewWhere).then((r) => r[0]),
		db.select({ count: count() }).from(analyticsSession).where(baseSessionWhere).then((r) => r[0]),
		db.select({ totalRevenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` }).from(payment).where(basePaymentWhere).then((r) => r[0]),
		db.select({ count: count() }).from(visitor).where(and(eq(visitor.websiteId, site.id), eq(visitor.isCustomer, true), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end))).then((r) => r[0]),
		db.select({ pathname: pageview.pathname, count: count() }).from(pageview).where(basePageviewWhere).groupBy(pageview.pathname).orderBy(desc(count())).limit(10),
		db.select({ referrer: pageview.referrer, count: count() }).from(pageview).where(and(basePageviewWhere, sql`${pageview.referrer} IS NOT NULL`, sql`${pageview.referrer} != ''`)).groupBy(pageview.referrer).orderBy(desc(count())).limit(20),
		db.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, count: count() }).from(analyticsSession).where(baseSessionWhere).groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium).orderBy(desc(count())).limit(50),
		db.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)` }).from(payment).innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id)).where(basePaymentWhere).groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium).orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`)).limit(20),
		db.select({ country: analyticsSession.country, count: count() }).from(analyticsSession).where(and(baseSessionWhere, sql`${analyticsSession.country} IS NOT NULL AND ${analyticsSession.country} != ''`)).groupBy(analyticsSession.country).orderBy(desc(count())).limit(10)
	]);

	const filteredReferrers = topReferrersRaw.filter((r) => !isInternalReferrer(r.referrer)).slice(0, 10);

	const channelCounts = new Map<string, number>();
	for (const session of sessionReferrers) {
		const channel = categorizeChannel(session.referrer, session.utmSource, session.utmMedium);
		channelCounts.set(channel, (channelCounts.get(channel) || 0) + Number(session.count));
	}
	const channelData = Array.from(channelCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([label, value]) => ({ label, value }));

	const channelRevenueMap = new Map<string, number>();
	for (const item of revenueByChannelRaw) {
		const channel = categorizeChannel(item.referrer, item.utmSource, item.utmMedium);
		channelRevenueMap.set(channel, (channelRevenueMap.get(channel) || 0) + Number(item.revenue));
	}
	const revenueByChannel = Array.from(channelRevenueMap.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([label, value]) => ({ label, value }));

	const avgSessionDuration = await (async () => {
		try {
			const sessionDurations = await db
				.select({
					sessionId: pageview.sessionId,
					minTime: sql<Date>`MIN(${pageview.timestamp})`.as('min_time'),
					maxTime: sql<Date>`MAX(${pageview.timestamp})`.as('max_time')
				})
				.from(pageview)
				.where(and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
				.groupBy(pageview.sessionId)
				.having(sql`COUNT(*) > 1`)
				.limit(1000);
			if (sessionDurations.length === 0) return 0;
			let totalMs = 0;
			for (const s of sessionDurations) {
				totalMs += new Date(s.maxTime).getTime() - new Date(s.minTime).getTime();
			}
			return Math.round(totalMs / sessionDurations.length);
		} catch {
			return 0;
		}
	})();

	const visitorsArr = await db
		.select({ id: visitor.id, lastSeen: visitor.lastSeen })
		.from(visitor)
		.where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
		.limit(5000);

	const visitorByDate = new Map<string, Set<string>>();
	for (const v of visitorsArr) {
		const dateStr = v.lastSeen.toISOString().split('T')[0];
		if (!visitorByDate.has(dateStr)) visitorByDate.set(dateStr, new Set());
		visitorByDate.get(dateStr)!.add(v.id);
	}
	const visitorMap = new Map<string, number>();
	for (const [date, visitorSet] of visitorByDate) {
		visitorMap.set(date, visitorSet.size);
	}

	const pageviewsArr = await db
		.select({ timestamp: pageview.timestamp })
		.from(pageview)
		.where(basePageviewWhere)
		.limit(5000);

	const pageviewMap = new Map<string, number>();
	for (const pv of pageviewsArr) {
		const dateStr = pv.timestamp.toISOString().split('T')[0];
		pageviewMap.set(dateStr, (pageviewMap.get(dateStr) || 0) + 1);
	}

	const revenuePayments = await db
		.select({ timestamp: payment.timestamp, amount: payment.amount })
		.from(payment)
		.where(and(eq(payment.websiteId, site.id), gte(payment.timestamp, start), lte(payment.timestamp, end)))
		.limit(5000);

	const revenueMap = new Map<string, number>();
	for (const p of revenuePayments) {
		const dateStr = p.timestamp.toISOString().split('T')[0];
		revenueMap.set(dateStr, (revenueMap.get(dateStr) || 0) + Number(p.amount));
	}

	const allDates = new Set([...pageviewMap.keys(), ...visitorMap.keys(), ...revenueMap.keys()]);
	const sortedDates = Array.from(allDates).sort();

	const timeSeries = sortedDates.map((date) => ({
		date,
		visitors: visitorMap.get(date) || 0,
		pageviews: pageviewMap.get(date) || 0,
		revenue: revenueMap.get(date) || 0,
		customers: 0
	}));

	const stats = {
		visitors: Number(visitorStats?.count || 0),
		pageviews: Number(pageviewStats?.count || 0),
		sessions: Number(sessionStats?.count || 0),
		avgSessionDuration,
		online: 0,
		revenue: Number(totalRevenue?.totalRevenue || 0),
		revenuePerVisitor: Number(visitorStats?.count || 0) > 0 ? Number(totalRevenue?.totalRevenue || 0) / Number(visitorStats?.count) : 0,
		conversionRate: Number(visitorStats?.count || 0) > 0 ? (Number(customerCount?.count || 0) / Number(visitorStats?.count)) * 100 : 0,
		customers: Number(customerCount?.count || 0)
	};

	const topReferrers = filteredReferrers.map((r) => {
		let label = 'Direct';
		try {
			label = new URL(r.referrer || '').hostname.replace(/^www\./, '');
		} catch {}
		return { label, value: r.count };
	});

	const topPagesMapped = topPages.map((p) => ({ label: p.pathname || '/', value: Number(p.count) }));
	const topCountries = countryStats.map((c) => ({ label: c.country || 'Unknown', value: c.count }));

	try {
		const insights = await generateInsights(
			site.id,
			{
				stats,
				timeSeries,
				topReferrers,
				topChannels: channelData,
				topCountries,
				topPages: topPagesMapped,
				revenueByChannel
			},
			start.toISOString(),
			end.toISOString()
		);

		return json(insights);
	} catch (e) {
		console.error('[Insights] Failed to generate insights:', e);
		return json(
			{
				trend: 'insufficient_data',
				trendConfidence: 0,
				topDriver: 'unknown',
				topDriverConfidence: 0,
				quality: 'moderate',
				qualityConfidence: 0,
				anomalyScore: 0,
				revenueTrend: 'no_revenue_data',
				revenueTrendConfidence: 0,
				opportunity: 'underutilized_content',
				opportunityConfidence: 0
			},
			{ status: 200 }
		);
	}
};
