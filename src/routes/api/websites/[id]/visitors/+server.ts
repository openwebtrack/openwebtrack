import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsSession, website, visitor } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';

export const GET: RequestHandler = async ({ locals, params }) => {
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

	const uniqueVisitors = await db
		.select({
			visitorId: analyticsSession.visitorId,
			name: visitor.name,
			avatar: visitor.avatar,
			isCustomer: visitor.isCustomer,
			lastActivityAt: sql<string>`MAX(${analyticsSession.lastActivityAt})`.as('last_activity'),
			country: sql<string | null>`(array_agg(${analyticsSession.country} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			device: sql<string | null>`(array_agg(${analyticsSession.deviceType} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			os: sql<string | null>`(array_agg(${analyticsSession.os} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			browser: sql<string | null>`(array_agg(${analyticsSession.browser} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			referrer: sql<string | null>`(array_agg(${analyticsSession.referrer} ORDER BY ${analyticsSession.lastActivityAt} DESC) FILTER (WHERE ${analyticsSession.referrer} IS NOT NULL))[1]`,
			region: sql<string | null>`(array_agg(${analyticsSession.region} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			city: sql<string | null>`(array_agg(${analyticsSession.city} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			screenWidth: sql<number | null>`(array_agg(${analyticsSession.screenWidth} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			screenHeight: sql<number | null>`(array_agg(${analyticsSession.screenHeight} ORDER BY ${analyticsSession.lastActivityAt} DESC))[1]`,
			isPwa: sql<boolean>`bool_or(${analyticsSession.isPwa})`.as('is_pwa')
		})
		.from(analyticsSession)
		.leftJoin(visitor, eq(analyticsSession.visitorId, visitor.id))
		.where(eq(analyticsSession.websiteId, site.id))
		.groupBy(analyticsSession.visitorId, visitor.name, visitor.avatar, visitor.isCustomer)
		.orderBy(sql`MAX(${analyticsSession.lastActivityAt}) DESC`)
		.limit(100);

	return json(uniqueVisitors);
};
