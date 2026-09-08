import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';
import { getTierBySlug, getTierByPlanName } from '$lib/server/saas/pricing';
import { clearEntitlementCache } from '$lib/server/saas/entitlements';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!SAAS_MODE) return json({ error: 'SAAS not enabled' }, { status: 404 });
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const slug = (body as { slug?: unknown })?.slug;
	if (typeof slug !== 'string' || !slug) {
		return json({ error: 'Missing slug' }, { status: 400 });
	}

	const tier = getTierBySlug(slug);
	if (!tier) {
		return json({ error: 'Product not found for slug' }, { status: 400 });
	}

	try {
		const db = (await import('$lib/server/db')).default;
		const { subscription } = await import('$lib/server/db/auth.schema');
		const { and, eq, inArray } = await import('drizzle-orm');

		const rows = await db
			.select()
			.from(subscription)
			.where(
				and(
					eq(subscription.referenceId, locals.user.id),
					inArray(subscription.status, ['active', 'trialing'])
				)
			)
			.limit(1);
		const activeSub = rows[0];

		if (!activeSub) {
			return json({ error: 'No active subscription to switch. Use checkout to subscribe.' }, { status: 400 });
		}

		const currentTier = getTierByPlanName(activeSub.plan);
		if (currentTier?.slug === tier.slug) {
			return json({ error: 'Already on this plan' }, { status: 400 });
		}

		if (!activeSub.stripeSubscriptionId) {
			return json({ error: 'Subscription missing Stripe ID, contact support' }, { status: 500 });
		}

		const { stripeClient } = await import('$lib/server/saas/stripe');
		const stripeSub = await stripeClient.subscriptions.retrieve(activeSub.stripeSubscriptionId);
		const item = stripeSub.items.data[0];
		if (!item) {
			return json({ error: 'No subscription items found' }, { status: 500 });
		}

		await stripeClient.subscriptions.update(activeSub.stripeSubscriptionId, {
			items: [{ id: item.id, price: tier.priceId }],
			proration_behavior: 'create_prorations'
		});

		clearEntitlementCache(locals.user.id);
		clearEntitlementCache();

		return json({ success: true, subscriptionId: activeSub.id, priceId: tier.priceId });
	} catch (e) {
		console.error('[billing] switch-plan failed', e);
		const msg = e instanceof Error ? e.message : 'Switch failed';
		return json({ error: msg }, { status: 500 });
	}
};
