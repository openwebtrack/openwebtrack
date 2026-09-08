import { Polar } from '@polar-sh/sdk';
import { polar, checkout, portal, webhooks } from '@polar-sh/better-auth';
import { env } from '$env/dynamic/private';
import { PRICING_TIERS } from '$lib/server/saas/pricing';

const polarServer: 'sandbox' | 'production' =
	env.POLAR_SERVER === 'production' ? 'production' : 'sandbox';

if (!env.POLAR_ACCESS_TOKEN) {
	throw new Error('POLAR_ACCESS_TOKEN is required when SAAS_MODE=true');
}

if (PRICING_TIERS.length === 0) {
	throw new Error('POLAR_PRODUCTS is required when SAAS_MODE=true');
}

export const polarClient = new Polar({
	accessToken: env.POLAR_ACCESS_TOKEN,
	server: polarServer
});

export const polarPlugins = [
	polar({
		client: polarClient,
		createCustomerOnSignUp: true,
		use: [
			checkout({
				products: PRICING_TIERS.map(({ productId, slug }) => ({ productId, slug })),
				successUrl: '/billing/success?checkout_id={CHECKOUT_ID}',
				authenticatedUsersOnly: true
			}),
			portal(),
			webhooks({
				secret: env.POLAR_WEBHOOK_SECRET || '',
				onSubscriptionActive: async (payload) => {
					const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
					clearEntitlementCache();
				},
				onSubscriptionCanceled: async (payload) => {
					console.log('[polar] subscription canceled', payload);
					const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
					clearEntitlementCache();
				},
				onSubscriptionRevoked: async (payload) => {
					console.log('[polar] subscription revoked', payload);
					const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
					clearEntitlementCache();
				},
				onSubscriptionCreated: async () => {
					const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
					clearEntitlementCache();
				},
				onSubscriptionUpdated: async () => {
					const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
					clearEntitlementCache();
				}
			})
		]
	})
];