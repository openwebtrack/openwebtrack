import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.session || !locals.user) {
		redirect(302, `/auth?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	return { user: locals.user, session: locals.session };
};
