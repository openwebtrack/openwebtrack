import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	if (env.ENABLE_DEMO_PAGE !== 'true') {
		throw error(404, 'Not Found');
	}

	return {};
};
