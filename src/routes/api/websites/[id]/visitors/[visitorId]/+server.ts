import { website, visitor, analyticsSession, pageview, analyticsEvent } from '$lib/server/db/schema';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	if (!isValidUUID(params.visitorId)) {
		throw error(400, 'Invalid visitor ID');
	}

	const access = await checkWebsiteAccess(locals.user.id, params.id);

	if (!access) {
		throw error(404, 'Website not found');
	}

	const site = access.site;

	const visitorId = params.visitorId;

	const [visitorData] = await db
		.select()
		.from(visitor)
		.where(and(eq(visitor.websiteId, site.id), eq(visitor.id, visitorId)))
		.limit(1);

	if (!visitorData) {
		throw error(404, 'Visitor not found');
	}

	const sessions = await db
		.select()
		.from(analyticsSession)
		.where(and(eq(analyticsSession.websiteId, site.id), eq(analyticsSession.visitorId, visitorId)))
		.orderBy(desc(analyticsSession.startedAt));

	const sessionIds = sessions.map((s) => s.id);

	let pageviews: (typeof pageview.$inferSelect)[] = [];
	let events: (typeof analyticsEvent.$inferSelect)[] = [];

	if (sessionIds.length > 0) {
		const MAX_SESSIONS = 100;
		const limitedSessionIds = sessionIds.slice(0, MAX_SESSIONS);

		[pageviews, events] = await Promise.all([
			db.select().from(pageview).where(inArray(pageview.sessionId, limitedSessionIds)).orderBy(asc(pageview.timestamp)),
			db.select().from(analyticsEvent).where(inArray(analyticsEvent.sessionId, limitedSessionIds)).orderBy(asc(analyticsEvent.timestamp))
		]);
	}

	const journey = sessions.map((session) => {
		const sessionPageviews = pageviews.filter((p) => p.sessionId === session.id);
		const sessionEvents = events.filter((e) => e.sessionId === session.id);

		const activities = [...sessionPageviews.map((p) => ({ activityType: 'pageview' as const, ...p })), ...sessionEvents.map((e) => ({ activityType: 'event' as const, ...e }))].sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		);

		return {
			...session,
			activities
		};
	});

	return json({
		visitor: visitorData,
		journey
	});
};
