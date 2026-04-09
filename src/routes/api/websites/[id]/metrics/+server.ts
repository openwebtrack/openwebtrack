import { visitor, analyticsSession, pageview, analyticsEvent, payment } from '$lib/server/db/schema';
import { eq, and, count, desc, sql, gte, lte, ilike } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { parseDateRange, parseFilters, escapeLikePattern, buildFilterConditions, categorizeChannel, checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { metricsQuerySchema, validateQuery } from '$lib/server/validation';
import { DEFAULT_QUERY_LIMITS } from '@/utils/constants';

type MetricRow = { label: string; value: number; revenue: number; customers: number; icon?: string };

/** Merge revenue and customer maps into the base data array by label. */
function mergeRevAndCustomers(data: { label: string; value: number; icon?: string }[], revMap: Map<string, number>, custMap: Map<string, number>): MetricRow[] {
	return data.map((d) => ({
		...d,
		revenue: revMap.get(d.label) ?? 0,
		customers: custMap.get(d.label) ?? 0
	}));
}

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

	const queryValidation = validateQuery(metricsQuerySchema, url.searchParams);
	if (!queryValidation.success) {
		return json({ error: queryValidation.error, errors: queryValidation.errors }, { status: 400 });
	}

	const { start, end } = parseDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'));
	const filters = parseFilters(url.searchParams.get('filters'));
	const { sessionConditions, pageviewConditions, eventConditions } = buildFilterConditions(filters);

	const type = queryValidation.data.type;
	const searchRaw = queryValidation.data.search || '';
	const search = escapeLikePattern(searchRaw);
	const limit = queryValidation.data.limit;

	const basePageviewWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end), ...pageviewConditions);
	const baseSessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, start), lte(analyticsSession.startedAt, end), ...sessionConditions);
	const basePaymentWhere = and(eq(payment.websiteId, site.id), gte(payment.timestamp, start), lte(payment.timestamp, end));

	let data: MetricRow[] = [];

	switch (type) {
		case 'pages': {
			const whereClause = search ? and(basePageviewWhere, ilike(pageview.pathname, `%${search}%`)) : basePageviewWhere;
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ pathname: pageview.pathname, count: count() }).from(pageview).where(whereClause).groupBy(pageview.pathname).orderBy(desc(count())).limit(limit),
				db
					.select({ pathname: pageview.pathname, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.innerJoin(pageview, and(eq(pageview.sessionId, analyticsSession.id), eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
					.where(basePaymentWhere)
					.groupBy(pageview.pathname)
					.orderBy(desc(sql<number>`COALESCE(SUM(${payment.amount}), 0)`)),
				db
					.select({ pathname: pageview.pathname, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.innerJoin(pageview, and(eq(pageview.sessionId, analyticsSession.id), eq(pageview.websiteId, site.id), gte(pageview.timestamp, start), lte(pageview.timestamp, end)))
					.where(baseSessionWhere)
					.groupBy(pageview.pathname)
			]);
			const revMap = new Map(revRows.map((r) => [r.pathname!, Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.pathname!, Number(r.customers)]));
			data = rows.map((r) => ({ label: r.pathname, value: r.count, revenue: revMap.get(r.pathname) ?? 0, customers: custMap.get(r.pathname) ?? 0 }));
			break;
		}
		case 'entry_pages': {
			try {
				const sessions = await db.select({ id: analyticsSession.id, startedAt: analyticsSession.startedAt }).from(analyticsSession).where(baseSessionWhere);
				const sessionStartTimes = new Map(sessions.map((s) => [s.id, s.startedAt]));

				const pageviewsForEntry = await db.select({ sessionId: pageview.sessionId, pathname: pageview.pathname, timestamp: pageview.timestamp }).from(pageview).where(basePageviewWhere);

				const entryPageCounts = new Map<string, number>();
				for (const pv of pageviewsForEntry) {
					const sessionStart = sessionStartTimes.get(pv.sessionId);
					if (sessionStart) {
						const diffMs = pv.timestamp.getTime() - sessionStart.getTime();
						if (diffMs <= 5000) {
							if (!search || pv.pathname.toLowerCase().includes(search.toLowerCase())) {
								entryPageCounts.set(pv.pathname, (entryPageCounts.get(pv.pathname) || 0) + 1);
							}
						}
					}
				}

				data = Array.from(entryPageCounts.entries())
					.map(([pathname, c]) => ({ label: pathname, value: c, revenue: 0, customers: 0 }))
					.sort((a, b) => b.value - a.value)
					.slice(0, limit);
			} catch (e) {
				console.error('Error fetching entry pages:', e);
			}
			break;
		}
		case 'exit_links': {
			const whereClause = and(
				eq(analyticsEvent.websiteId, site.id),
				eq(analyticsEvent.type, 'exit_link'),
				gte(analyticsEvent.timestamp, start),
				lte(analyticsEvent.timestamp, end),
				...eventConditions
			);

			const rows = await db
				.select({ name: analyticsEvent.name, data: analyticsEvent.data, count: count() })
				.from(analyticsEvent)
				.where(whereClause)
				.groupBy(analyticsEvent.name, analyticsEvent.data)
				.orderBy(desc(count()))
				.limit(limit * 2);

			data = rows
				.map((e) => {
					const d = e.data as Record<string, unknown> | null;
					const label = (d?.url as string) || (d?.text as string) || 'External link';
					return { label, value: e.count, revenue: 0, customers: 0 };
				})
				.filter((d) => !search || d.label.toLowerCase().includes(search.toLowerCase()))
				.slice(0, limit);
			break;
		}
		case 'referrers': {
			const whereClause = and(basePageviewWhere, sql`${pageview.referrer} IS NOT NULL`, sql`${pageview.referrer} != ''`, search ? ilike(pageview.referrer, `%${search}%`) : undefined);

			const [rows, revRows, custRows] = await Promise.all([
				db.select({ referrer: pageview.referrer, count: count() }).from(pageview).where(whereClause).groupBy(pageview.referrer).orderBy(desc(count())).limit(limit),
				db
					.select({ referrer: analyticsSession.referrer, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(basePaymentWhere)
					.groupBy(analyticsSession.referrer),
				db
					.select({ referrer: analyticsSession.referrer, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(baseSessionWhere)
					.groupBy(analyticsSession.referrer)
			]);

			const revMap = new Map(revRows.map((r) => [r.referrer ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.referrer ?? '', Number(r.customers)]));

			data = rows.map((r) => {
				let label = r.referrer || 'Direct';
				const rawRef = r.referrer ?? '';
				try {
					const u = new URL(r.referrer || '');
					label = u.hostname.replace(/^www\./, '');
				} catch {}
				return { label, value: r.count, revenue: revMap.get(rawRef) ?? 0, customers: custMap.get(rawRef) ?? 0 };
			});
			break;
		}
		case 'channels': {
			const [sessionReferrers, revRows, custRows] = await Promise.all([
				db
					.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, count: count() })
					.from(analyticsSession)
					.where(baseSessionWhere)
					.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium),
				db
					.select({
						referrer: analyticsSession.referrer,
						utmSource: analyticsSession.utmSource,
						utmMedium: analyticsSession.utmMedium,
						revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue')
					})
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(basePaymentWhere)
					.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium),
				db
					.select({
						referrer: analyticsSession.referrer,
						utmSource: analyticsSession.utmSource,
						utmMedium: analyticsSession.utmMedium,
						customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers')
					})
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(baseSessionWhere)
					.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium)
			]);

			const channelCounts = new Map<string, number>();
			const channelRevenue = new Map<string, number>();
			const channelCustomers = new Map<string, number>();

			for (const session of sessionReferrers) {
				const ch = categorizeChannel(session.referrer, session.utmSource, session.utmMedium);
				if (!search || ch.toLowerCase().includes(search.toLowerCase())) {
					channelCounts.set(ch, (channelCounts.get(ch) || 0) + Number(session.count));
				}
			}
			for (const r of revRows) {
				const ch = categorizeChannel(r.referrer, r.utmSource, r.utmMedium);
				channelRevenue.set(ch, (channelRevenue.get(ch) || 0) + Number(r.revenue));
			}
			for (const r of custRows) {
				const ch = categorizeChannel(r.referrer, r.utmSource, r.utmMedium);
				channelCustomers.set(ch, (channelCustomers.get(ch) || 0) + Number(r.customers));
			}

			data = Array.from(channelCounts.entries())
				.map(([label, value]) => ({ label, value, revenue: channelRevenue.get(label) ?? 0, customers: channelCustomers.get(label) ?? 0 }))
				.sort((a, b) => b.value - a.value)
				.slice(0, limit);
			break;
		}
		case 'campaigns': {
			const [rows, revRows, custRows] = await Promise.all([
				db
					.select({ utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, utmCampaign: analyticsSession.utmCampaign, count: count() })
					.from(analyticsSession)
					.where(
						and(
							baseSessionWhere,
							sql`(${analyticsSession.utmSource} IS NOT NULL AND ${analyticsSession.utmSource} != '') OR (${analyticsSession.utmMedium} IS NOT NULL AND ${analyticsSession.utmMedium} != '') OR (${analyticsSession.utmCampaign} IS NOT NULL AND ${analyticsSession.utmCampaign} != '')`
						)
					)
					.groupBy(analyticsSession.utmSource, analyticsSession.utmMedium, analyticsSession.utmCampaign)
					.orderBy(desc(count()))
					.limit(limit * 2),
				db
					.select({
						utmSource: analyticsSession.utmSource,
						utmMedium: analyticsSession.utmMedium,
						utmCampaign: analyticsSession.utmCampaign,
						revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue')
					})
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(basePaymentWhere)
					.groupBy(analyticsSession.utmSource, analyticsSession.utmMedium, analyticsSession.utmCampaign),
				db
					.select({
						utmSource: analyticsSession.utmSource,
						utmMedium: analyticsSession.utmMedium,
						utmCampaign: analyticsSession.utmCampaign,
						customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers')
					})
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(baseSessionWhere)
					.groupBy(analyticsSession.utmSource, analyticsSession.utmMedium, analyticsSession.utmCampaign)
			]);

			const makeLabel = (r: { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }) => {
				const parts: string[] = [];
				if (r.utmSource) parts.push(`utm_source=${r.utmSource}`);
				if (r.utmMedium) parts.push(`utm_medium=${r.utmMedium}`);
				if (r.utmCampaign) parts.push(`utm_campaign=${r.utmCampaign}`);
				return parts.length > 0 ? `?${parts.join('&')}` : 'Unknown';
			};

			const revMap = new Map(revRows.map((r) => [makeLabel(r), Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [makeLabel(r), Number(r.customers)]));

			data = rows
				.map((c) => {
					const label = makeLabel(c);
					return { label, value: c.count, revenue: revMap.get(label) ?? 0, customers: custMap.get(label) ?? 0 };
				})
				.filter((d) => !search || d.label.toLowerCase().includes(search.toLowerCase()))
				.slice(0, limit);
			break;
		}
		case 'countries': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.country} IS NOT NULL`,
				sql`${analyticsSession.country} != ''`,
				search ? ilike(analyticsSession.country, `%${search}%`) : undefined
			);
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ country: analyticsSession.country, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.country).orderBy(desc(count())).limit(limit),
				db
					.select({ country: analyticsSession.country, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.country} IS NOT NULL`))
					.groupBy(analyticsSession.country),
				db
					.select({ country: analyticsSession.country, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.country)
			]);
			const revMap = new Map(revRows.map((r) => [r.country ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.country ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.country || 'Unknown', value: r.count, revenue: revMap.get(r.country ?? '') ?? 0, customers: custMap.get(r.country ?? '') ?? 0 }));
			break;
		}
		case 'regions': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.region} IS NOT NULL`,
				sql`${analyticsSession.region} != ''`,
				search ? ilike(analyticsSession.region, `%${search}%`) : undefined
			);
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ region: analyticsSession.region, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.region).orderBy(desc(count())).limit(limit),
				db
					.select({ region: analyticsSession.region, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.region} IS NOT NULL`))
					.groupBy(analyticsSession.region),
				db
					.select({ region: analyticsSession.region, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.region)
			]);
			const revMap = new Map(revRows.map((r) => [r.region ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.region ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.region || 'Unknown', value: r.count, revenue: revMap.get(r.region ?? '') ?? 0, customers: custMap.get(r.region ?? '') ?? 0 }));
			break;
		}
		case 'cities': {
			const whereClause = and(baseSessionWhere, sql`${analyticsSession.city} IS NOT NULL`, sql`${analyticsSession.city} != ''`, search ? ilike(analyticsSession.city, `%${search}%`) : undefined);
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ city: analyticsSession.city, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.city).orderBy(desc(count())).limit(limit),
				db
					.select({ city: analyticsSession.city, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.city} IS NOT NULL`))
					.groupBy(analyticsSession.city),
				db
					.select({ city: analyticsSession.city, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.city)
			]);
			const revMap = new Map(revRows.map((r) => [r.city ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.city ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.city || 'Unknown', value: r.count, revenue: revMap.get(r.city ?? '') ?? 0, customers: custMap.get(r.city ?? '') ?? 0 }));
			break;
		}
		case 'browsers': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.browser} IS NOT NULL`,
				sql`${analyticsSession.browser} != ''`,
				search ? ilike(analyticsSession.browser, `%${search}%`) : undefined
			);
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ browser: analyticsSession.browser, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.browser).orderBy(desc(count())).limit(limit),
				db
					.select({ browser: analyticsSession.browser, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.browser} IS NOT NULL`))
					.groupBy(analyticsSession.browser),
				db
					.select({ browser: analyticsSession.browser, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.browser)
			]);
			const revMap = new Map(revRows.map((r) => [r.browser ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.browser ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.browser || 'Unknown', value: r.count, revenue: revMap.get(r.browser ?? '') ?? 0, customers: custMap.get(r.browser ?? '') ?? 0 }));
			break;
		}
		case 'os': {
			const whereClause = and(baseSessionWhere, sql`${analyticsSession.os} IS NOT NULL`, sql`${analyticsSession.os} != ''`, search ? ilike(analyticsSession.os, `%${search}%`) : undefined);
			const [rows, revRows, custRows] = await Promise.all([
				db.select({ os: analyticsSession.os, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.os).orderBy(desc(count())).limit(limit),
				db
					.select({ os: analyticsSession.os, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.os} IS NOT NULL`))
					.groupBy(analyticsSession.os),
				db
					.select({ os: analyticsSession.os, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.os)
			]);
			const revMap = new Map(revRows.map((r) => [r.os ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.os ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.os || 'Unknown', value: r.count, revenue: revMap.get(r.os ?? '') ?? 0, customers: custMap.get(r.os ?? '') ?? 0 }));
			break;
		}
		case 'devices': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.deviceType} IS NOT NULL`,
				sql`${analyticsSession.deviceType} != ''`,
				search ? ilike(analyticsSession.deviceType, `%${search}%`) : undefined
			);
			const [rows, revRows, custRows] = await Promise.all([
				db
					.select({ deviceType: analyticsSession.deviceType, count: count() })
					.from(analyticsSession)
					.where(whereClause)
					.groupBy(analyticsSession.deviceType)
					.orderBy(desc(count()))
					.limit(limit),
				db
					.select({ deviceType: analyticsSession.deviceType, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.deviceType} IS NOT NULL`))
					.groupBy(analyticsSession.deviceType),
				db
					.select({ deviceType: analyticsSession.deviceType, customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers') })
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(whereClause)
					.groupBy(analyticsSession.deviceType)
			]);
			const revMap = new Map(revRows.map((r) => [r.deviceType ?? '', Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [r.deviceType ?? '', Number(r.customers)]));
			data = rows.map((r) => ({ label: r.deviceType || 'Unknown', value: r.count, revenue: revMap.get(r.deviceType ?? '') ?? 0, customers: custMap.get(r.deviceType ?? '') ?? 0 }));
			break;
		}
		case 'screens': {
			const [rows, revRows, custRows] = await Promise.all([
				db
					.select({ screenWidth: analyticsSession.screenWidth, screenHeight: analyticsSession.screenHeight, count: count() })
					.from(analyticsSession)
					.where(and(baseSessionWhere, sql`${analyticsSession.screenWidth} IS NOT NULL`))
					.groupBy(analyticsSession.screenWidth, analyticsSession.screenHeight)
					.orderBy(desc(count()))
					.limit(limit * 2),
				db
					.select({ screenWidth: analyticsSession.screenWidth, screenHeight: analyticsSession.screenHeight, revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.innerJoin(analyticsSession, eq(payment.sessionId, analyticsSession.id))
					.where(and(basePaymentWhere, sql`${analyticsSession.screenWidth} IS NOT NULL`))
					.groupBy(analyticsSession.screenWidth, analyticsSession.screenHeight),
				db
					.select({
						screenWidth: analyticsSession.screenWidth,
						screenHeight: analyticsSession.screenHeight,
						customers: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})`.as('customers')
					})
					.from(analyticsSession)
					.innerJoin(visitor, and(eq(visitor.id, analyticsSession.visitorId), eq(visitor.isCustomer, true)))
					.where(and(baseSessionWhere, sql`${analyticsSession.screenWidth} IS NOT NULL`))
					.groupBy(analyticsSession.screenWidth, analyticsSession.screenHeight)
			]);
			const revMap = new Map(revRows.map((r) => [`${r.screenWidth}x${r.screenHeight}`, Number(r.revenue)]));
			const custMap = new Map(custRows.map((r) => [`${r.screenWidth}x${r.screenHeight}`, Number(r.customers)]));
			data = rows
				.map((d) => {
					const label = `${d.screenWidth}x${d.screenHeight}`;
					return { label, value: d.count, revenue: revMap.get(label) ?? 0, customers: custMap.get(label) ?? 0 };
				})
				.filter((d) => !search || d.label.includes(search))
				.slice(0, limit);
			break;
		}
		case 'hostnames': {
			const [visitorRow, revRow, custRow] = await Promise.all([
				db
					.select({ count: count() })
					.from(visitor)
					.where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
					.then((r) => r[0]),
				db
					.select({ revenue: sql<number>`COALESCE(SUM(${payment.amount}), 0)`.as('revenue') })
					.from(payment)
					.where(basePaymentWhere)
					.then((r) => r[0]),
				db
					.select({ customers: count() })
					.from(visitor)
					.where(and(eq(visitor.websiteId, site.id), eq(visitor.isCustomer, true), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
					.then((r) => r[0])
			]);
			data = [{ label: site.domain, value: visitorRow.count, revenue: Number(revRow.revenue), customers: custRow.customers }];
			break;
		}
	}

	return json(data);
};
