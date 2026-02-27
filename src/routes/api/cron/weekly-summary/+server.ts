import { website, user, analyticsSession, pageview } from '$lib/server/db/schema';
import WeeklySummaryEmail from '$lib/server/email/templates/WeeklySummaryEmail';
import { sendEmail, isEmailConfigured } from '$lib/server/email';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import db from '$lib/server/db';

const CRON_SECRET = env.CRON_SECRET;
const ORIGIN = env.ORIGIN;

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('Authorization');
	const token = authHeader?.replace(/^Bearer\s+/i, '');

	if (!CRON_SECRET || token !== CRON_SECRET) {
		console.log('[Weekly Summary] Invalid cron secret');
		return json({ message: 'Invalid cron secret' }, { status: 401 });
	}

	if (!isEmailConfigured()) return json({ message: 'Email not configured' });

	const allWebsites = await db.select().from(website).innerJoin(user, eq(website.userId, user.id));

	const websitesWithWeeklySummary = allWebsites.filter((w) => {
		const notifs = w.website.notifications as { weeklySummary?: { enabled: boolean } } | undefined;
		return notifs?.weeklySummary?.enabled === true;
	});

	let sentCount = 0;
	let failedCount = 0;

	for (const site of websitesWithWeeklySummary) {
		const now = new Date();
		try {
			const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

			const [visitorCount] = await db
				.select({ count: sql<number>`count(distinct ${analyticsSession.visitorId})` })
				.from(analyticsSession)
				.where(and(eq(analyticsSession.websiteId, site.website.id), gte(analyticsSession.startedAt, weekAgo)));

			const [pageviewCount] = await db
				.select({ count: sql<number>`count(*)` })
				.from(pageview)
				.where(and(eq(pageview.websiteId, site.website.id), gte(pageview.timestamp, weekAgo)));

			const topPages = await db
				.select({ pathname: pageview.pathname, views: sql<number>`count(*)` })
				.from(pageview)
				.where(and(eq(pageview.websiteId, site.website.id), gte(pageview.timestamp, weekAgo)))
				.groupBy(pageview.pathname)
				.orderBy(desc(sql<number>`count(*)`))
				.limit(5);

			const topReferrers = (
				await db
					.select({ referrer: analyticsSession.referrer, visits: sql<number>`count(*)` })
					.from(analyticsSession)
					.where(and(eq(analyticsSession.websiteId, site.website.id), gte(analyticsSession.startedAt, weekAgo), sql`${analyticsSession.referrer} is not null`))
					.groupBy(analyticsSession.referrer)
					.orderBy(desc(sql<number>`count(*)`))
					.limit(5)
			).map((r) => ({ referrer: r.referrer!, visits: r.visits }));

			const topCountries = (
				await db
					.select({ country: analyticsSession.country, visits: sql<number>`count(*)` })
					.from(analyticsSession)
					.where(and(eq(analyticsSession.websiteId, site.website.id), gte(analyticsSession.startedAt, weekAgo), sql`${analyticsSession.country} is not null`))
					.groupBy(analyticsSession.country)
					.orderBy(desc(sql<number>`count(*)`))
					.limit(5)
			).map((r) => ({ country: r.country!, visits: r.visits }));

			const periodStart = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			const periodEnd = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

			const result = await sendEmail({
				to: site.user.email,
				subject: `Weekly Summary for ${site.website.domain}`,
				children: WeeklySummaryEmail({
					dashboardUrl: `${ORIGIN}/dashboard/${site.website.id}`,
					totalPageviews: pageviewCount?.count || 0,
					generatedAt: new Date().toLocaleString(),
					totalVisitors: visitorCount?.count || 0,
					domain: site.website.domain,
					topReferrers,
					topCountries,
					periodStart,
					periodEnd,
					topPages
				}),
				plain: `Weekly analytics summary for ${site.website.domain} from ${periodStart} to ${periodEnd}. Total visitors: ${visitorCount?.count || 0}, Pageviews: ${pageviewCount?.count || 0}`
			});

			if (result) {
				sentCount++;
			} else {
				failedCount++;
			}
		} catch (err) {
			console.error(`[Weekly Summary] Error for ${site.website.domain}:`, err);
			failedCount++;
		}
	}

	return json({ message: `Processed ${websitesWithWeeklySummary.length} websites. Sent: ${sentCount}, Failed: ${failedCount}` });
};
