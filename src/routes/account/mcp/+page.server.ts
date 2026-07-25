import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/auth?redirectTo=/account/mcp');
	return { user: locals.user, mcpServerUrl: `${(env.ORIGIN || url.origin).replace(/\/$/, '')}/api/mcp` };
};
