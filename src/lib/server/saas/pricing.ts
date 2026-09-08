import { env } from '$env/dynamic/private';
import { SAAS_MODE } from '$lib/config';

export type PricingTier = {
	slug: string;
	productId: string;
	name: string;
	price: string;
	featured?: boolean;
	maxWebsites: number;
	maxEventsPerMonth: number;
	maxMembersPerWebsite: number;
	features: string[];
};

let cached: PricingTier[] | null = null;

const TIER_DEFAULTS: Record<string, Omit<PricingTier, 'slug' | 'productId' | 'name' | 'price' | 'featured'>> = {
	starter: {
		maxWebsites: 2,
		maxEventsPerMonth: 50_000,
		maxMembersPerWebsite: 2,
		features: [
			'2 websites',
			'50,000 events / month',
			'2 members per website',
			'Real-time analytics & dashboard',
			'Funnels, UTM & geo insights',
			'6 months data retention',
			'Community support'
		]
	},
	growth: {
		maxWebsites: 6,
		maxEventsPerMonth: 500_000,
		maxMembersPerWebsite: 10,
		features: [
			'6 websites',
			'500,000 events / month',
			'10+ members per website',
			'Everything in Starter',
			'12 months data retention',
			'Priority support'
		]
	}
};

function parseTiers(raw: string | undefined): PricingTier[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			throw new Error('POLAR_PRODUCTS must be a JSON array');
		}
		return parsed.map((t: PricingTier & Record<string, unknown>) => {
			if (!t.slug || !t.productId || !t.name || !t.price) {
				throw new Error(
					`Invalid POLAR_PRODUCTS entry - each tier needs slug, productId, name, price`
				);
			}
			const defaults = TIER_DEFAULTS[t.slug] ?? { maxWebsites: 1, maxEventsPerMonth: 10_000, maxMembersPerWebsite: 1, features: [] };
			return {
				slug: t.slug,
				productId: t.productId,
				name: t.name,
				price: t.price,
				featured: (t.featured as boolean | undefined) ?? false,
				maxWebsites: typeof t.maxWebsites === 'number' ? t.maxWebsites : defaults.maxWebsites,
				maxEventsPerMonth: typeof t.maxEventsPerMonth === 'number' ? t.maxEventsPerMonth : defaults.maxEventsPerMonth,
				maxMembersPerWebsite: typeof t.maxMembersPerWebsite === 'number' ? t.maxMembersPerWebsite : defaults.maxMembersPerWebsite,
				features: Array.isArray(t.features) ? (t.features as string[]) : defaults.features
			};
		});
	} catch (err) {
		throw new Error(`Failed to parse POLAR_PRODUCTS: ${(err as Error).message}`);
	}
}

export const PRICING_TIERS: PricingTier[] = SAAS_MODE
	? (cached ??= parseTiers(env.POLAR_PRODUCTS))
	: [];

export const POLAR_PRODUCT_MAP: Record<string, string> = Object.fromEntries(
	PRICING_TIERS.map((t) => [t.slug, t.productId])
);

export function getTierBySlug(slug: string): PricingTier | undefined {
	return PRICING_TIERS.find((t) => t.slug === slug);
}