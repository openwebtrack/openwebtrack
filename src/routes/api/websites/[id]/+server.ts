import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { website } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

	const { domain, timezone = access.site.timezone, excludedIps, excludedPaths, excludedCountries, notifications } = validation.data;

	const updateData: Record<string, unknown> = { domain, timezone };
	if (excludedIps !== undefined) updateData.excludedIps = excludedIps;
	if (excludedPaths !== undefined) updateData.excludedPaths = excludedPaths;
	if (excludedCountries !== undefined) updateData.excludedCountries = excludedCountries;
	if (notifications !== undefined) updateData.notifications = notifications;

	const [updated] = await db.update(website).set(updateData).where(eq(website.id, params.id)).returning();

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
