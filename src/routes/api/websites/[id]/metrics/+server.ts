import { website, visitor, analyticsSession, pageview, analyticsEvent } from '$lib/server/db/schema';
import { eq, and, count, desc, sql, gte, lte, ilike } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { parseDateRange, parseFilters, escapeLikePattern, buildFilterConditions, categorizeChannel, checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { metricsQuerySchema, validateQuery } from '$lib/server/validation';
import { DEFAULT_QUERY_LIMITS } from '$lib/constants';

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

	let data: { label: string; value: number; icon?: string }[] = [];

	switch (type) {
		case 'pages': {
			const whereClause = search ? and(basePageviewWhere, ilike(pageview.pathname, `%${search}%`)) : basePageviewWhere;
			const rows = await db.select({ pathname: pageview.pathname, count: count() }).from(pageview).where(whereClause).groupBy(pageview.pathname).orderBy(desc(count())).limit(limit);
			data = rows.map((r) => ({ label: r.pathname, value: r.count }));
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
					.map(([pathname, count]) => ({ label: pathname, value: count }))
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
				eq(analyticsEvent.type, 'custom'),
				eq(analyticsEvent.name, 'external_link'),
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
					return { label, value: e.count };
				})
				.filter((d) => !search || d.label.toLowerCase().includes(search.toLowerCase()))
				.slice(0, limit);
			break;
		}
		case 'referrers': {
			const whereClause = and(basePageviewWhere, sql`${pageview.referrer} IS NOT NULL`, sql`${pageview.referrer} != ''`, search ? ilike(pageview.referrer, `%${search}%`) : undefined);

			const rows = await db.select({ referrer: pageview.referrer, count: count() }).from(pageview).where(whereClause).groupBy(pageview.referrer).orderBy(desc(count())).limit(limit);

			data = rows.map((r) => {
				let label = r.referrer || 'Direct';
				try {
					const url = new URL(r.referrer || '');
					label = url.hostname.replace(/^www\./, '');
				} catch {}
				return { label, value: r.count };
			});
			break;
		}
		case 'channels': {
			const sessionReferrers = await db
				.select({ referrer: analyticsSession.referrer, utmSource: analyticsSession.utmSource, utmMedium: analyticsSession.utmMedium, count: count() })
				.from(analyticsSession)
				.where(baseSessionWhere)
				.groupBy(analyticsSession.referrer, analyticsSession.utmSource, analyticsSession.utmMedium);

			const channelCounts = new Map<string, number>();
			for (const session of sessionReferrers) {
				const channel = categorizeChannel(session.referrer, session.utmSource, session.utmMedium);
				if (!search || channel.toLowerCase().includes(search.toLowerCase())) {
					channelCounts.set(channel, (channelCounts.get(channel) || 0) + Number(session.count));
				}
			}

			data = Array.from(channelCounts.entries())
				.map(([label, value]) => ({ label, value }))
				.sort((a, b) => b.value - a.value)
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

			const rows = await db
				.select({ country: analyticsSession.country, count: count() })
				.from(analyticsSession)
				.where(whereClause)
				.groupBy(analyticsSession.country)
				.orderBy(desc(count()))
				.limit(limit);

			data = rows.map((r) => ({ label: r.country || 'Unknown', value: r.count }));
			break;
		}
		case 'regions': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.region} IS NOT NULL`,
				sql`${analyticsSession.region} != ''`,
				search ? ilike(analyticsSession.region, `%${search}%`) : undefined
			);

			const rows = await db
				.select({ region: analyticsSession.region, count: count() })
				.from(analyticsSession)
				.where(whereClause)
				.groupBy(analyticsSession.region)
				.orderBy(desc(count()))
				.limit(limit);

			data = rows.map((r) => ({ label: r.region || 'Unknown', value: r.count }));
			break;
		}
		case 'cities': {
			const whereClause = and(baseSessionWhere, sql`${analyticsSession.city} IS NOT NULL`, sql`${analyticsSession.city} != ''`, search ? ilike(analyticsSession.city, `%${search}%`) : undefined);

			const rows = await db.select({ city: analyticsSession.city, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.city).orderBy(desc(count())).limit(limit);

			data = rows.map((r) => ({ label: r.city || 'Unknown', value: r.count }));
			break;
		}
		case 'browsers': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.browser} IS NOT NULL`,
				sql`${analyticsSession.browser} != ''`,
				search ? ilike(analyticsSession.browser, `%${search}%`) : undefined
			);

			const rows = await db
				.select({ browser: analyticsSession.browser, count: count() })
				.from(analyticsSession)
				.where(whereClause)
				.groupBy(analyticsSession.browser)
				.orderBy(desc(count()))
				.limit(limit);

			data = rows.map((r) => ({ label: r.browser || 'Unknown', value: r.count }));
			break;
		}
		case 'os': {
			const whereClause = and(baseSessionWhere, sql`${analyticsSession.os} IS NOT NULL`, sql`${analyticsSession.os} != ''`, search ? ilike(analyticsSession.os, `%${search}%`) : undefined);

			const rows = await db.select({ os: analyticsSession.os, count: count() }).from(analyticsSession).where(whereClause).groupBy(analyticsSession.os).orderBy(desc(count())).limit(limit);

			data = rows.map((r) => ({ label: r.os || 'Unknown', value: r.count }));
			break;
		}
		case 'devices': {
			const whereClause = and(
				baseSessionWhere,
				sql`${analyticsSession.deviceType} IS NOT NULL`,
				sql`${analyticsSession.deviceType} != ''`,
				search ? ilike(analyticsSession.deviceType, `%${search}%`) : undefined
			);

			const rows = await db
				.select({ deviceType: analyticsSession.deviceType, count: count() })
				.from(analyticsSession)
				.where(whereClause)
				.groupBy(analyticsSession.deviceType)
				.orderBy(desc(count()))
				.limit(limit);

			data = rows.map((r) => ({ label: r.deviceType || 'Unknown', value: r.count }));
			break;
		}
		case 'screens': {
			const rows = await db
				.select({ screenWidth: analyticsSession.screenWidth, screenHeight: analyticsSession.screenHeight, count: count() })
				.from(analyticsSession)
				.where(and(baseSessionWhere, sql`${analyticsSession.screenWidth} IS NOT NULL`))
				.groupBy(analyticsSession.screenWidth, analyticsSession.screenHeight)
				.orderBy(desc(count()))
				.limit(limit * 2);

			data = rows
				.map((d) => ({ label: `${d.screenWidth}x${d.screenHeight}`, value: d.count }))
				.filter((d) => !search || d.label.includes(search))
				.slice(0, limit);
			break;
		}
		case 'hostnames': {
			data = [
				{
					label: site.domain,
					value: (
						await db
							.select({ count: count() })
							.from(visitor)
							.where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, start), lte(visitor.lastSeen, end)))
					)[0].count
				}
			];
			break;
		}
	}

	return json(data);
};
