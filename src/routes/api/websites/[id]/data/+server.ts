import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsSession, pageview, visitor, analyticsEvent } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';

export const DELETE: RequestHandler = async ({ locals, params }) => {
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

	if (!access.isOwner) {
		throw error(403, 'Only the website owner can wipe data');
	}

	const site = access.site;

	await db.delete(pageview).where(eq(pageview.websiteId, site.id));
	await db.delete(analyticsEvent).where(eq(analyticsEvent.websiteId, site.id));
	await db.delete(analyticsSession).where(eq(analyticsSession.websiteId, site.id));
	await db.delete(visitor).where(eq(visitor.websiteId, site.id));

	return json({ success: true, message: 'All analytics data has been wiped' });
};
