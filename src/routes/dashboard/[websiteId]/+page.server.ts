import { redirect, error } from '@sveltejs/kit';
import { website, teamMember } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import type { PageServerLoad } from './$types';
import { eq, and, getTableColumns, inArray } from 'drizzle-orm';
import db from '$lib/server/db';
import { isValidUUID } from '$lib/server/utils';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(302, '/auth?redirectTo=/dashboard/' + params.websiteId);
	}

	if (!isValidUUID(params.websiteId)) {
		throw error(400, 'Invalid website ID');
	}

	const result = await db
		.select({
			...getTableColumns(website),
			ownerName: user.name,
			ownerEmail: user.email
		})
		.from(website)
		.leftJoin(user, eq(website.userId, user.id))
		.where(eq(website.id, params.websiteId))
		.limit(1);

	const site = result[0];

	if (!site) {
		throw error(404, 'Website not found');
	}

	const isOwner = site.userId === locals.user.id;

	if (!isOwner) {
		const [membership] = await db
			.select()
			.from(teamMember)
			.where(and(eq(teamMember.websiteId, params.websiteId), eq(teamMember.userId, locals.user.id)))
			.limit(1);

		if (!membership) {
			throw error(403, 'Forbidden');
		}
	}

	const ownedWebsites = await db.select().from(website).where(eq(website.userId, locals.user.id));
	const ownedWebsiteIds = new Set(ownedWebsites.map((w) => w.id));
	const memberships = await db.select({ websiteId: teamMember.websiteId }).from(teamMember).where(eq(teamMember.userId, locals.user.id));
	const sharedWebsiteIds = memberships.map((m) => m.websiteId);

	let sharedWebsites: (typeof website.$inferSelect)[] = [];
	if (sharedWebsiteIds.length > 0) {
		sharedWebsites = await db.select().from(website).where(inArray(website.id, sharedWebsiteIds));
	}

	const allWebsites = [...ownedWebsites.map((w) => ({ ...w, isOwner: true })), ...sharedWebsites.map((w) => ({ ...w, isOwner: false }))];

	return {
		user: locals.user,
		website: {
			...site,
			owner: site.ownerName ? { name: site.ownerName, email: site.ownerEmail } : undefined
		},
		isOwner,
		websites: allWebsites
	};
};
