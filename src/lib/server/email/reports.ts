import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import { analyticsSession, pageview, website } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import db from '$lib/server/db';

export interface WeeklyReportData {
	totalVisitors: number;
	totalPageviews: number;
	topPages: { pathname: string; count: number }[];
	referrers: { referrer: string; count: number }[];
	countries: { country: string; count: number }[];
}

export interface TrafficSpikeData {
	currentVisitors: number;
	previousVisitors: number;
	percentIncrease: number;
}

export async function generateWeeklyReport(websiteId: string, limit: number = 5): Promise<WeeklyReportData> {
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const visitorCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, sevenDaysAgo), lt(analyticsSession.startedAt, now)))
		.then((res) => res[0]?.count || 0);

	const pageviewCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(pageview)
		.where(and(eq(pageview.websiteId, websiteId), gte(pageview.timestamp, sevenDaysAgo), lt(pageview.timestamp, now)))
		.then((res) => res[0]?.count || 0);

	const topPagesData = await db
		.select({
			pathname: pageview.pathname,
			count: sql<number>`count(*)`
		})
		.from(pageview)
		.where(and(eq(pageview.websiteId, websiteId), gte(pageview.timestamp, sevenDaysAgo), lt(pageview.timestamp, now)))
		.groupBy(pageview.pathname)
		.orderBy(desc(sql<number>`count(*)`))
		.limit(limit);

	const referrersData = await db
		.select({
			referrer: analyticsSession.referrer,
			count: sql<number>`count(*)`
		})
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, sevenDaysAgo), lt(analyticsSession.startedAt, now)))
		.groupBy(analyticsSession.referrer)
		.orderBy(desc(sql<number>`count(*)`))
		.limit(limit);

	const countriesData = await db
		.select({
			country: analyticsSession.country,
			count: sql<number>`count(*)`
		})
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, sevenDaysAgo), lt(analyticsSession.startedAt, now)))
		.groupBy(analyticsSession.country)
		.orderBy(desc(sql<number>`count(*)`))
		.limit(limit);

	return {
		totalVisitors: visitorCount,
		totalPageviews: pageviewCount,
		topPages: topPagesData.map((p) => ({ pathname: p.pathname || '/', count: Number(p.count) })),
		referrers: referrersData.map((r) => ({ referrer: r.referrer || '', count: Number(r.count) })),
		countries: countriesData.map((c) => ({ country: c.country || 'Unknown', count: Number(c.count) }))
	};
}

export async function checkTrafficSpike(websiteId: string): Promise<TrafficSpikeData | null> {
	const now = new Date();
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
	const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

	const currentPeriodStart = oneHourAgo;
	const previousPeriodStart = twoHoursAgo;
	const baselinePeriodEnd = threeHoursAgo;

	const currentVisitors = await db
		.select({ count: sql<number>`count(*)` })
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, currentPeriodStart), lt(analyticsSession.startedAt, now)))
		.then((res) => res[0]?.count || 0);

	const previousVisitors = await db
		.select({ count: sql<number>`count(*)` })
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, previousPeriodStart), lt(analyticsSession.startedAt, currentPeriodStart)))
		.then((res) => res[0]?.count || 0);

	const baselineVisitors = await db
		.select({ count: sql<number>`count(*)` })
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, websiteId), gte(analyticsSession.startedAt, baselinePeriodEnd), lt(analyticsSession.startedAt, previousPeriodStart)))
		.then((res) => res[0]?.count || 0);

	if (baselineVisitors === 0 || previousVisitors === 0) {
		return null;
	}

	const avgBaseline = (previousVisitors + baselineVisitors) / 2;
	const percentIncrease = ((currentVisitors - avgBaseline) / avgBaseline) * 100;

	if (percentIncrease < 50) {
		return null;
	}

	return {
		currentVisitors,
		previousVisitors: Math.round(avgBaseline),
		percentIncrease
	};
}

export async function getWebsitesWithEmailReports(): Promise<{ id: string; domain: string; userEmail: string; emailReportsWeekly: boolean; emailReportsTrafficSpike: boolean }[]> {
	const defaultNotifications = {
		trafficSpike: { enabled: false, threshold: 100, windowSeconds: 60 },
		weeklySummary: { enabled: false }
	};

	const allWebsites = await db
		.select({
			id: website.id,
			domain: website.domain,
			userEmail: user.email,
			notifications: website.notifications
		})
		.from(website)
		.innerJoin(user, eq(website.userId, user.id));

	const result: { id: string; domain: string; userEmail: string; emailReportsWeekly: boolean; emailReportsTrafficSpike: boolean }[] = [];

	for (const w of allWebsites) {
		const notifs = (w.notifications as typeof defaultNotifications) || defaultNotifications;
		if (notifs.weeklySummary?.enabled || notifs.trafficSpike?.enabled) {
			result.push({
				id: w.id,
				domain: w.domain,
				userEmail: w.userEmail,
				emailReportsWeekly: notifs.weeklySummary?.enabled || false,
				emailReportsTrafficSpike: notifs.trafficSpike?.enabled || false
			});
		}
	}

	return result;
}
