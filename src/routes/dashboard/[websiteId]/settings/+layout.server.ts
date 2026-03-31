import { redirect, error } from '@sveltejs/kit';
import { website } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { isValidUUID } from '$lib/server/utils';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/auth?redirectTo=/dashboard/' + params.websiteId + '/settings');
	}

	if (!isValidUUID(params.websiteId)) {
		throw error(400, 'Invalid website ID');
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
		website: {
			...site,
			excludedIps: site.excludedIps || [],
			excludedPaths: site.excludedPaths || [],
			excludedCountries: site.excludedCountries || []
		}
	};
};
