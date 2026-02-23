import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { website, teamMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { isValidUUID } from '$lib/server/utils';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	if (!isValidUUID(params.memberId)) {
		throw error(400, 'Invalid member ID');
	}

	const [site] = await db.select().from(website).where(eq(website.id, params.id)).limit(1);

	if (!site) {
		throw error(404, 'Website not found');
	}

	if (site.userId !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	const [member] = await db
		.select()
		.from(teamMember)
		.where(and(eq(teamMember.id, params.memberId), eq(teamMember.websiteId, params.id)))
		.limit(1);

	if (!member) {
		throw error(404, 'Team member not found');
	}

	await db.delete(teamMember).where(eq(teamMember.id, params.memberId));

	return json({ success: true });
};
