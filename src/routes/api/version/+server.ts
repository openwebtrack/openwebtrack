import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getUpdateStatus } from '$lib/server/updates';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	return json(await getUpdateStatus());
};
