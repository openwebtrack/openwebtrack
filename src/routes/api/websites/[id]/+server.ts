import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { website, visitor, analyticsSession, pageview, analyticsEvent, teamMember } from '$lib/server/db/schema';
import { eq, and, count, desc, sql, gte, lte } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { websiteUpdateSchema, validateBody } from '$lib/server/validation';

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

	return json({ ...access.site, isOwner: access.isOwner });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
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
		throw error(403, 'Forbidden');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const validation = validateBody(websiteUpdateSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	}

	const { domain, timezone = access.site.timezone } = validation.data;

	const [updated] = await db.update(website).set({ domain, timezone }).where(eq(website.id, params.id)).returning();

	return json(updated);
};

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
		throw error(403, 'Forbidden');
	}

	await db.delete(website).where(eq(website.id, params.id));

	return json({ success: true });
};
