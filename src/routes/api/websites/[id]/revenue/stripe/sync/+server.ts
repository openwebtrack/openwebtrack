import { stripeIntegration } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { backfillStripeCheckoutSessions, getStripeCredentials } from '$lib/server/revenue/stripe-helpers';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const syncSchema = z.object({
	limit: z.coerce.number().int().min(1).max(500).default(100)
});

/**
 * One-off (and repeatable) backfill: pull recent paid Checkout Sessions from
 * the Stripe API and attribute them via the stored visitor/session metadata.
 * Safe to re-run — inserts are deduplicated by Stripe session id.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	let limit = 100;
	try {
		const body = await request.json().catch(() => ({}));
		const parsed = syncSchema.safeParse(body);
		if (parsed.success) limit = parsed.data.limit;
	} catch {
		// empty body -> defaults
	}

	const creds = await getStripeCredentials(params.id);
	if (!creds) return json({ error: 'Stripe not connected for this website' }, { status: 400 });

	try {
		const result = await backfillStripeCheckoutSessions(creds.secretKey, params.id, limit);
		await db.update(stripeIntegration).set({ lastSyncedAt: new Date(), status: 'active', lastError: null }).where(eq(stripeIntegration.websiteId, params.id));
		return json({ success: true, ...result });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Stripe sync failed';
		await db.update(stripeIntegration).set({ status: 'error', lastError: message }).where(eq(stripeIntegration.websiteId, params.id));
		return json({ error: message }, { status: 502 });
	}
};
