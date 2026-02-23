import { redirect, error } from '@sveltejs/kit';
import { website, teamMember } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';
import { eq, and } from 'drizzle-orm';
import db from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/auth?redirectTo=/dashboard/' + params.websiteId + '/settings');
	}

	const [site] = await db.select().from(website).where(eq(website.id, params.websiteId)).limit(1);

	if (!site) {
		throw error(404, 'Website not found');
	}

	if (site.userId !== locals.user.id) {
		throw error(403, 'Forbidden');
	}

	return {
		user: locals.user,
		website: site
	};
};
