import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/auth?redirectTo=/dashboard/new');
	if (SAAS_MODE) {
		const { getEntitlementForUser } = await import('$lib/server/saas/entitlements');
		const ent = await getEntitlementForUser(locals.user.id);
		if (ent.dashboardLocked) redirect(302, '/account?tab=billing&reason=dashboard_locked');
		// Don't block, just let page handle 402 - but we can pass ent for UI
		const { default: db } = await import('$lib/server/db');
		const { website } = await import('$lib/server/db/schema');
		const { eq, count } = await import('drizzle-orm');
		const [{ count: c }] = await db.select({ count: count() }).from(website).where(eq(website.userId, locals.user.id));
		if (c >= ent.maxWebsites) {
			// still allow page but client will show upgrade - optional redirect:
			// redirect(302, '/account?tab=billing&reason=limit_reached');
		}
	}
	return {};
};