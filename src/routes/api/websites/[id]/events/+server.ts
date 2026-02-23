import { website, visitor, analyticsSession, analyticsEvent } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import getCountryCode from '$lib/utils/country-mapping';
import { generateVisitorName } from '$lib/server/visitor-utils';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { eventsQuerySchema, validateQuery } from '$lib/server/validation';

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

	const queryValidation = validateQuery(eventsQuerySchema, url.searchParams);
	if (!queryValidation.success) {
		return json({ error: queryValidation.error, errors: queryValidation.errors }, { status: 400 });
	}

	const { limit, offset } = queryValidation.data;

	// Fetch recent events with visitor details
	const events = await db
		.select({
			id: analyticsEvent.id,
			type: analyticsEvent.type,
			name: analyticsEvent.name,
			data: analyticsEvent.data,
			timestamp: analyticsEvent.timestamp,
			visitor: {
				id: visitor.id,
				name: visitor.name,
				avatar: visitor.avatar
			},
			location: {
				country: analyticsSession.country,
				city: analyticsSession.city
			}
		})
		.from(analyticsEvent)
		.innerJoin(analyticsSession, eq(analyticsEvent.sessionId, analyticsSession.id))
		.innerJoin(visitor, eq(analyticsSession.visitorId, visitor.id))
		.where(eq(analyticsEvent.websiteId, site.id))
		.orderBy(desc(analyticsEvent.timestamp))
		.limit(limit)
		.offset(offset);

	const formattedEvents = events.map((e) => {
		const countryCode = getCountryCode(e.location.country);
		const countryFlag = countryCode ? `https://flagsapi.com/${countryCode}/flat/64.png` : '';

		return {
			id: e.id,
			type: e.type,
			name: e.name || e.type,
			data: e.data,
			timestamp: e.timestamp,
			visitor: {
				id: e.visitor.id,
				name: e.visitor.name || generateVisitorName(e.visitor.id),
				avatar: e.visitor.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${e.visitor.id}`,
				country: e.location.country || 'Unknown',
				countryFlag: countryFlag,
				city: e.location.city
			}
		};
	});

	return json(formattedEvents);
};
