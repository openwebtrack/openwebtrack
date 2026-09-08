import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ensureStripeCustomer } from '$lib/server/saas/ensureCustomer';
import { SAAS_MODE } from '$lib/config';

export const POST: RequestHandler = async ({ locals }) => {
	if (!SAAS_MODE) return json({ error: 'SAAS not enabled' }, { status: 404 });
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const result = await ensureStripeCustomer({
			id: locals.user.id,
			email: locals.user.email,
			name: locals.user.name
		});
		const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
		clearEntitlementCache(locals.user.id);
		return json(result);
	} catch (e) {
		console.error('[billing] ensure-customer failed', e);
		return json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
	}
};
