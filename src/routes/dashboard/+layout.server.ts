import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.session || !locals.user) {
		redirect(302, `/auth?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	if (SAAS_MODE) {
		const { getEntitlementForUser } = await import('$lib/server/saas/entitlements');
		const ent = await getEntitlementForUser(locals.user.id);
		if (ent.dashboardLocked) {
			redirect(302, `/account?tab=billing&reason=dashboard_locked`);
		}
	}

	return { user: locals.user, session: locals.session };
};
