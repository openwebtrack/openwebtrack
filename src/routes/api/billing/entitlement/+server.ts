import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';
import { getEntitlementForUser } from '$lib/server/saas/entitlements';
import db from '$lib/server/db';
import { website, pageview, analyticsEvent } from '$lib/server/db/schema';
import { eq, and, gte, inArray, count } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!SAAS_MODE) return json({ saasEnabled: false });

	const ent = await getEntitlementForUser(locals.user.id);

	const owned = await db.select({ id: website.id }).from(website).where(eq(website.userId, locals.user.id));
	const ownedIds = owned.map((w) => w.id);
	let usedEvents = 0;
	if (ownedIds.length > 0) {
		const startOfMonth = new Date();
		startOfMonth.setUTCDate(1);
		startOfMonth.setUTCHours(0, 0, 0, 0);
		const [pv] = await db.select({ count: count() }).from(pageview).where(and(inArray(pageview.websiteId, ownedIds), gte(pageview.timestamp, startOfMonth)));
		const [ev] = await db.select({ count: count() }).from(analyticsEvent).where(and(inArray(analyticsEvent.websiteId, ownedIds), gte(analyticsEvent.timestamp, startOfMonth)));
		usedEvents = (pv?.count ?? 0) + (ev?.count ?? 0);
	}

	const [{ count: websiteCount }] = await db.select({ count: count() }).from(website).where(eq(website.userId, locals.user.id));

	return json({
		saasEnabled: true,
		entitlement: ent,
		usage: {
			websites: websiteCount,
			eventsThisMonth: usedEvents
		}
	});
};