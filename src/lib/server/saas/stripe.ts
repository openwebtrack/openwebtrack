import Stripe from 'stripe';
import { stripe } from '@better-auth/stripe';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { extractAttribution, recordStripePayment, resolveVisitorAndSession } from '$lib/server/revenue/stripe-helpers';
import { analyticsEvent } from '$lib/server/db/schema';
import db from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';
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
	freeTrial?: { days: number; onTrialStart?: (subscription: { plan: string; stripeSubscriptionId?: string } | null) => Promise<void> };
} {
	const base: {
		name: string;
		priceId: string;
		limits: {
			maxWebsites: number;
			maxEventsPerMonth: number;
			maxMembersPerWebsite: number;
		};
		freeTrial?: { days: number; onTrialStart?: (subscription: { plan: string; stripeSubscriptionId?: string } | null) => Promise<void> };
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
		base.freeTrial = {
			days: tier.trialPeriodDays,
			// better-auth may pass null if the row update returned nothing
			onTrialStart: async (subscription) => {
				if (!subscription?.stripeSubscriptionId) return;
				await recordOwnEvent(subscription.stripeSubscriptionId, 'trial_started', { plan: subscription.plan });
			}
		};
	}

	return base;
}

/** Visitor/session saved on the Stripe subscription at checkout (see readOwtCookies). */
async function getSubscriptionAttribution(stripeSubscriptionId?: string | null) {
	if (!stripeSubscriptionId) return extractAttribution(null);
	const sub = await getStripeClient().subscriptions.retrieve(stripeSubscriptionId);
	return extractAttribution(sub.metadata);
}

/** Self-tracking: record a custom event (e.g. trial_started) on our own OpenWebTrack website. */
async function recordOwnEvent(stripeSubscriptionId: string, name: string, data: Record<string, unknown>) {
	const websiteId = publicEnv.PUBLIC_OWT_WEBSITE_ID;
	if (!websiteId) return;
	try {
		// Stripe retries webhooks - only record once per subscription
		const [dup] = await db
			.select({ id: analyticsEvent.id })
			.from(analyticsEvent)
			.where(and(eq(analyticsEvent.websiteId, websiteId), eq(analyticsEvent.name, name), sql`${analyticsEvent.data}->>'subscriptionId' = ${stripeSubscriptionId}`))
			.limit(1);
		if (dup) return;

		const attribution = await getSubscriptionAttribution(stripeSubscriptionId);
		const { sessionId } = await resolveVisitorAndSession(websiteId, attribution.visitorId, attribution.sessionId);
		await db.insert(analyticsEvent).values({ sessionId, websiteId, type: 'custom', name, data: { ...data, subscriptionId: stripeSubscriptionId } });
	} catch (e) {
		console.error(`[stripe] failed to record own event ${name}:`, e instanceof Error ? e.message : e);
	}
}

/**
 * Self-tracking: record paid cloud invoices as payments on our own OpenWebTrack
 * website (PUBLIC_OWT_WEBSITE_ID), attributed via the owt_* metadata set at checkout.
 */
async function recordOwnRevenue(event: Stripe.Event) {
	const websiteId = publicEnv.PUBLIC_OWT_WEBSITE_ID;
	if (!websiteId || event.type !== 'invoice.paid') return;

	const invoice = event.data.object;
	// Trial / $0 invoices aren't revenue
	if (!invoice.id || !invoice.amount_paid) return;

	try {
		const details = invoice.parent?.subscription_details;
		const subRef = details?.subscription;
		const { visitorId, sessionId } = details?.metadata?.owt_visitor_id ? extractAttribution(details.metadata) : await getSubscriptionAttribution(typeof subRef === 'string' ? subRef : subRef?.id);

		await recordStripePayment({
			websiteId,
			visitorId,
			sessionId,
			amount: invoice.amount_paid,
			currency: invoice.currency,
			transactionId: invoice.id,
			timestamp: new Date((invoice.status_transitions?.paid_at ?? event.created) * 1000)
		});
	} catch (e) {
		console.error('[stripe] failed to record own revenue:', e instanceof Error ? e.message : e);
	}
}

/** Tracker cookies (set on the root domain, so they reach the cloud app) as Stripe metadata. */
function readOwtCookies(req?: Request): Record<string, string> {
	// Values are user-controlled (the script accepts ?_owt_uid=...); only pass real UUIDs
	// so a junk cookie can never make Stripe reject the checkout.
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const cookies = new Map<string, string>();
	for (const part of (req?.headers.get('cookie') ?? '').split(';')) {
		const i = part.indexOf('=');
		if (i > 0) cookies.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
	}
	const meta: Record<string, string> = {};
	const uid = cookies.get('_owt_uid');
	const ses = cookies.get('_owt_ses');
	if (uid && UUID_RE.test(uid)) meta.owt_visitor_id = uid;
	if (ses && UUID_RE.test(ses)) meta.owt_session_id = ses;
	return meta;
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
				onEvent: recordOwnRevenue,
				subscription: {
					enabled: true,
					plans: PRICING_TIERS.map(buildPlanOptions),
					// Cardless trials: only collect a payment method when payment is due immediately.
					// Trial checkouts skip the card form; paid checkouts still require it.
					getCheckoutSessionParams: async (_data, req) => {
						const attribution = readOwtCookies(req);
						return {
							params: {
								payment_method_collection: 'if_required',
								// Attribute the subscription (and every renewal invoice) to the visit
								metadata: attribution,
								subscription_data: { metadata: attribution }
							}
						};
					},
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
