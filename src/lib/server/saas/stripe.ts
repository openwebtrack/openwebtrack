import Stripe from 'stripe';
import { stripe } from '@better-auth/stripe';
import { env } from '$env/dynamic/private';
import { PRICING_TIERS, getPlanNameForTier } from '$lib/server/saas/pricing';

if (!env.STRIPE_SECRET_KEY) {
	throw new Error('STRIPE_SECRET_KEY is required when SAAS_MODE=true');
}

if (!env.STRIPE_WEBHOOK_SECRET) {
	throw new Error('STRIPE_WEBHOOK_SECRET is required when SAAS_MODE=true');
}

if (PRICING_TIERS.length === 0) {
	throw new Error(
		'Missing Stripe Price IDs (set STRIPE_PRICE_STARTER and STRIPE_PRICE_GROWTH) when SAAS_MODE=true'
	);
}

export const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
	// Pinned per https://better-auth.com/docs/plugins/stripe
	apiVersion: '2026-08-26.dahlia'
});

async function clearCache() {
	try {
		const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
		clearEntitlementCache();
	} catch {
		// ignore - entitlements module may not be loaded yet
	}
}

export const stripePlugins = [
	stripe({
		stripeClient,
		stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
		createCustomerOnSignUp: true,
		subscription: {
			enabled: true,
			plans: PRICING_TIERS.map((tier) => ({
				name: getPlanNameForTier(tier),
				priceId: tier.priceId,
				limits: {
					maxWebsites: tier.maxWebsites,
					maxEventsPerMonth: tier.maxEventsPerMonth,
					maxMembersPerWebsite: tier.maxMembersPerWebsite
				}
			})),
			onSubscriptionComplete: async () => {
				await clearCache();
			},
			onSubscriptionCreated: async () => {
				await clearCache();
			},
			onSubscriptionUpdate: async () => {
				await clearCache();
			},
			onSubscriptionCancel: async () => {
				console.log('[stripe] subscription canceled');
				await clearCache();
			},
			onSubscriptionDeleted: async () => {
				console.log('[stripe] subscription deleted');
				await clearCache();
			}
		}
	})
];
