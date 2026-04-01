import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { apiKey } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id) || !isValidUUID(params.keyId)) throw error(400, 'Invalid ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	const [deleted] = await db
		.delete(apiKey)
		.where(and(eq(apiKey.id, params.keyId), eq(apiKey.websiteId, params.id)))
		.returning({ id: apiKey.id });

	if (!deleted) throw error(404, 'API key not found');

	return json({ success: true });
};
