import { env } from '$env/dynamic/private';
import { SAAS_MODE } from '$lib/config';

export type PricingTier = {
	slug: string;
	/** Stripe Price ID (e.g. price_...). Replaces the old Polar productId. */
	priceId: string;
	name: string;
	price: string;
	featured?: boolean;
	maxWebsites: number;
	maxEventsPerMonth: number;
	maxMembersPerWebsite: number;
	features: string[];
	/** Trial days granted on first checkout (Stripe `trial_period_days`, card collected upfront). 0 = no trial. */
	trialPeriodDays: number;
};

/**
 * Days of free trial (card required) granted once per user on first subscription.
 * Override with STRIPE_TRIAL_DAYS (0 disables trials).
 */
export const TRIAL_DAYS: number = (() => {
	const raw = (env as Record<string, string | undefined>).STRIPE_TRIAL_DAYS;
	if (raw === undefined || raw === '') return 7;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 0 ? n : 7;
})();

let cached: PricingTier[] | null = null;

/**
 * Pricing is defined in code. Env only provides Stripe Price IDs,
 * one per tier: STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, ...
 * (or STRIPE_PRODUCTS as a JSON map {"starter":"price_..."}).
 */
const TIER_DEFINITIONS: Array<Omit<PricingTier, 'priceId' | 'trialPeriodDays'>> = [
	{
		slug: 'starter',
		name: 'Starter',
		price: '$7 / month',
		featured: false,
		maxWebsites: 2,
		maxEventsPerMonth: 50_000,
		maxMembersPerWebsite: 2,
		features: ['2 websites', '50,000 events / month', '2 members per website', 'Real-time analytics & dashboard', 'Funnels, UTM & geo insights', '6 months data retention', 'Community support']
	},
	{
		slug: 'growth',
		name: 'Growth',
		price: '$19 / month',
		featured: true,
		maxWebsites: 6,
		maxEventsPerMonth: 500_000,
		maxMembersPerWebsite: 10,
		features: ['6 websites', '500,000 events / month', '10+ members per website', 'Everything in Starter', '12 months data retention', 'Priority support']
	}
];

/** slug -> priceId from env. Supports STRIPE_PRICE_<SLUG> vars + STRIPE_PRODUCTS JSON map. */
function priceIdMapFromEnv(): Record<string, string> {
	const map: Record<string, string> = {};

	// 1) Per-tier vars: STRIPE_PRICE_STARTER=price_...
	for (const tier of TIER_DEFINITIONS) {
		const key = `STRIPE_PRICE_${tier.slug.toUpperCase()}`;
		const value = (env as Record<string, string | undefined>)[key];
		if (value) map[tier.slug] = value;
	}

	// 2) JSON map: STRIPE_PRODUCTS={"starter":"price_...","growth":"price_..."}
	const rawMap = env.STRIPE_PRODUCTS;
	if (rawMap) {
		try {
			const parsed: unknown = JSON.parse(rawMap);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				for (const [slug, priceId] of Object.entries(parsed as Record<string, unknown>)) {
					if (typeof priceId === 'string' && priceId) map[slug] = priceId;
				}
			}
		} catch {
			// Not a map — may be the legacy array form handled below
		}
	}

	return map;
}

/** Legacy: STRIPE_PRODUCTS / POLAR_PRODUCTS as JSON array with priceId/productId per tier. */
function priceIdsFromLegacyArray(): Record<string, string> {
	const raw = env.STRIPE_PRODUCTS ?? env.POLAR_PRODUCTS;
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return {};
		const map: Record<string, string> = {};
		for (const t of parsed as Array<Record<string, unknown>>) {
			const slug = t.slug as string | undefined;
			const priceId = (t.priceId as string | undefined) ?? (t.productId as string | undefined);
			if (slug && priceId) map[slug] = priceId;
		}
		return map;
	} catch {
		return {};
	}
}

function buildTiers(): PricingTier[] {
	const fromEnv = priceIdMapFromEnv();
	const legacy = priceIdsFromLegacyArray();
	const merged = { ...legacy, ...fromEnv };

	return TIER_DEFINITIONS.map((def) => {
		const priceId = merged[def.slug];
		if (!priceId) {
			throw new Error(`Missing Stripe Price ID for tier "${def.slug}" (set STRIPE_PRICE_${def.slug.toUpperCase()}=price_...)`);
		}
		return { ...def, priceId, trialPeriodDays: TRIAL_DAYS };
	});
}

export const PRICING_TIERS: PricingTier[] = SAAS_MODE ? (cached ??= buildTiers()) : [];

export const STRIPE_PRICE_MAP: Record<string, string> = Object.fromEntries(PRICING_TIERS.map((t) => [t.slug, t.priceId]));

/** @deprecated Use STRIPE_PRICE_MAP */
export const POLAR_PRODUCT_MAP: Record<string, string> = STRIPE_PRICE_MAP;

export function getTierBySlug(slug: string): PricingTier | undefined {
	return PRICING_TIERS.find((t) => t.slug === slug);
}

export function getTierByPriceId(priceId: string): PricingTier | undefined {
	return PRICING_TIERS.find((t) => t.priceId === priceId);
}

/** Plan name used by @better-auth/stripe (lower-cased slug). */
export function getPlanNameForTier(tier: PricingTier): string {
	return tier.slug.toLowerCase();
}

export function getTierByPlanName(plan: string): PricingTier | undefined {
	return PRICING_TIERS.find((t) => t.slug.toLowerCase() === plan.toLowerCase());
}
