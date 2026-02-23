import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { website, teamMember, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { isValidUUID } from '$lib/server/utils';
import { teamInviteSchema, validateBody } from '$lib/server/validation';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const [site] = await db.select().from(website).where(eq(website.id, params.id)).limit(1);

	if (!site) {
		throw error(404, 'Website not found');
	}

	if (site.userId !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	const members = await db
		.select({
			id: teamMember.id,
			userId: teamMember.userId,
			email: user.email,
			name: user.name,
			image: user.image,
			createdAt: teamMember.createdAt
		})
		.from(teamMember)
		.innerJoin(user, eq(teamMember.userId, user.id))
		.where(eq(teamMember.websiteId, params.id));

	return json(members);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const [site] = await db.select().from(website).where(eq(website.id, params.id)).limit(1);

	if (!site) {
		throw error(404, 'Website not found');
	}

	if (site.userId !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const validation = validateBody(teamInviteSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	}

	const { email } = validation.data;

	const [targetUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

	if (!targetUser) {
		throw error(404, 'User not found. They need to create an account first.');
	}

	if (targetUser.id === locals.user.id) {
		throw error(400, 'Cannot invite yourself');
	}

	const [existingMember] = await db
		.select()
		.from(teamMember)
		.where(and(eq(teamMember.websiteId, params.id), eq(teamMember.userId, targetUser.id)))
		.limit(1);

	if (existingMember) {
		throw error(409, 'User is already a team member');
	}

	const [newMember] = await db
		.insert(teamMember)
		.values({
			websiteId: params.id,
			userId: targetUser.id
		})
		.returning();

	return json(
		{
			id: newMember.id,
			userId: targetUser.id,
			email: targetUser.email,
			name: targetUser.name,
			image: targetUser.image,
			createdAt: newMember.createdAt
		},
		{ status: 201 }
	);
};
