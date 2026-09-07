import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';
import { getTierBySlug } from '$lib/server/saas/pricing';
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
		const { polarClient } = await import('$lib/server/saas/polar');

		// Prefer customer state (reliable, includes subscription id + productId)
		const state = await polarClient.customers.getStateExternal({ externalId: locals.user.id });
		const activeSubs = (state as unknown as { activeSubscriptions?: Array<{ id: string; status: string; productId?: string }> }).activeSubscriptions ?? [];
		const activeSub = activeSubs.find((s) => s.status === 'active') ?? activeSubs[0] ?? null;

		if (!activeSub) {
			return json({ error: 'No active subscription to switch. Use checkout to subscribe.' }, { status: 400 });
		}

		if (activeSub.productId === tier.productId) {
			return json({ error: 'Already on this plan' }, { status: 400 });
		}

		// Update the existing subscription to the new product – this switches plan in place
		// instead of creating a second subscription via checkout.
		await polarClient.subscriptions.update({
			id: activeSub.id,
			subscriptionUpdate: { productId: tier.productId }
		});

		clearEntitlementCache(locals.user.id);
		// also clear all (customer state may be cached per user)
		clearEntitlementCache();

		return json({ success: true, subscriptionId: activeSub.id, productId: tier.productId });
	} catch (e) {
		console.error('[billing] switch-plan failed', e);
		const msg = e instanceof Error ? e.message : 'Switch failed';
		// Surface AlreadyActive or validation errors with 400 where appropriate
		if (/AlreadyActive|already.*active/i.test(msg)) {
			return json({ error: 'Already has active subscription for this product' }, { status: 400 });
		}
		return json({ error: msg }, { status: 500 });
	}
};
