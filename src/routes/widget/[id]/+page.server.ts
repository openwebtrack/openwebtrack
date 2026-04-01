import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db';
import { website } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUUID } from '$lib/server/utils';

export const load: PageServerLoad = async ({ params }) => {
	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const [site] = await db.select().from(website).where(eq(website.id, params.id)).limit(1);

	if (!site) {
		throw error(404, 'Website not found');
	}

	return {
		website: site
	};
};
