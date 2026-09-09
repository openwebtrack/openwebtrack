import Stripe from 'stripe';
import { stripe } from '@better-auth/stripe';
import { env } from '$env/dynamic/private';
import { PRICING_TIERS, getPlanNameForTier } from '$lib/server/saas/pricing';

// NOTE: everything here is initialized lazily so that importing this module
// (e.g. during `vite build` route analysis or in self-hosted mode without
// Stripe keys) never throws. Misconfiguration only fails when SAAS features
// are actually used.
function requiredEnv(name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'): string {
	const value = env[name];
	if (!value) throw new Error(`${name} is required when SAAS_MODE=true`);
	return value;
}

let cachedClient: Stripe | undefined;
export function getStripeClient(): Stripe {
	if (!cachedClient) {
		cachedClient = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
			// Pinned per https://better-auth.com/docs/plugins/stripe
			apiVersion: '2026-08-26.dahlia'
		});
	}
	return cachedClient;
}

async function clearCache() {
	try {
		const { clearEntitlementCache } = await import('$lib/server/saas/entitlements');
		clearEntitlementCache();
	} catch {
		// ignore - entitlements module may not be loaded yet
	}
}

function buildPlanOptions(tier: (typeof PRICING_TIERS)[number]): {
	name: string;
	priceId: string;
	limits: {
		maxWebsites: number;
		maxEventsPerMonth: number;
		maxMembersPerWebsite: number;
	};
	freeTrial?: { days: number };
} {
	const base: {
		name: string;
		priceId: string;
		limits: {
			maxWebsites: number;
			maxEventsPerMonth: number;
			maxMembersPerWebsite: number;
		};
		freeTrial?: { days: number };
	} = {
		name: getPlanNameForTier(tier),
		priceId: tier.priceId,
		limits: {
			maxWebsites: tier.maxWebsites,
			maxEventsPerMonth: tier.maxEventsPerMonth,
			maxMembersPerWebsite: tier.maxMembersPerWebsite
		}
	};

	if (tier.trialPeriodDays && tier.trialPeriodDays > 0) {
		base.freeTrial = { days: tier.trialPeriodDays };
	}

	return base;
}

let cachedPlugins: ReturnType<typeof stripe>[] | undefined;
export function getStripePlugins(): ReturnType<typeof stripe>[] {
	if (!cachedPlugins) {
		if (PRICING_TIERS.length === 0) {
			throw new Error('Missing Stripe Price IDs (set STRIPE_PRICE_STARTER and STRIPE_PRICE_GROWTH) when SAAS_MODE=true');
		}
		cachedPlugins = [
			stripe({
				stripeClient: getStripeClient(),
				stripeWebhookSecret: requiredEnv('STRIPE_WEBHOOK_SECRET'),
				createCustomerOnSignUp: true,
				subscription: {
					enabled: true,
					plans: PRICING_TIERS.map(buildPlanOptions),
					// Cardless trials: only collect a payment method when payment is due immediately.
					// Trial checkouts skip the card form; paid checkouts still require it.
					getCheckoutSessionParams: async () => ({
						params: { payment_method_collection: 'if_required' }
					}),
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
	}
	return cachedPlugins;
}
