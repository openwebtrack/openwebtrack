import { SAAS_MODE } from '$lib/config';
import { PRICING_TIERS, POLAR_PRODUCT_MAP } from '$lib/server/saas/pricing';

export type Entitlement = {
	tierSlug: string | null;
	tierName: string | null;
	maxWebsites: number;
	maxEventsPerMonth: number;
	maxMembersPerWebsite: number;
	hasSubscription: boolean;
	dashboardLocked: boolean;
	graceDaysRemaining: number | null;
	expiredAt: Date | null;
};

const FREE_ENTITLEMENT: Entitlement = {
	tierSlug: null,
	tierName: null,
	maxWebsites: 0,
	maxEventsPerMonth: 0,
	maxMembersPerWebsite: 0,
	hasSubscription: false,
	dashboardLocked: false,
	graceDaysRemaining: null,
	expiredAt: null
};

const UNLIMITED_ENTITLEMENT: Entitlement = {
	tierSlug: 'unlimited',
	tierName: 'Unlimited',
	maxWebsites: Number.MAX_SAFE_INTEGER,
	maxEventsPerMonth: Number.MAX_SAFE_INTEGER,
	maxMembersPerWebsite: Number.MAX_SAFE_INTEGER,
	hasSubscription: true,
	dashboardLocked: false,
	graceDaysRemaining: null,
	expiredAt: null
};

const GRACE_DAYS = 5;

// Simple in-memory cache to avoid hammering Polar on every track request
const cache = new Map<string, { ent: Entitlement; expiresAt: number }>();
const CACHE_TTL_MS = 10_000;

function entitlementForSlug(slug: string | null): Entitlement {
	if (!slug) return FREE_ENTITLEMENT;
	const tier = PRICING_TIERS.find((t) => t.slug === slug);
	if (!tier) return FREE_ENTITLEMENT;
	return {
		tierSlug: tier.slug,
		tierName: tier.name,
		maxWebsites: tier.maxWebsites,
		maxEventsPerMonth: tier.maxEventsPerMonth,
		maxMembersPerWebsite: tier.maxMembersPerWebsite,
		hasSubscription: true,
		dashboardLocked: false,
		graceDaysRemaining: null,
		expiredAt: null
	};
}

async function getLastSubscriptionEnd(userId: string): Promise<Date | null> {
	try {
		const { polarClient } = await import('$lib/server/saas/polar');
		// List all subscriptions for this external customer (including inactive/cancelled)
		const res = await polarClient.subscriptions.list({
			externalCustomerId: userId
		});
		// SDK returns PageIterator, unwrap
		const items: Array<{ endsAt?: string | Date | null; currentPeriodEnd?: string | Date | null; status?: string; modifiedAt?: string | Date | null }> =
			(res as unknown as { result?: { items?: unknown[] }; items?: unknown[] }).result?.items as never ??
			(res as unknown as { items?: unknown[] }).items as never ??
			[];
		if (!items.length) return null;
		// Find most recent end date
		let latest: Date | null = null;
		for (const s of items) {
			const raw = (s.endsAt ?? s.currentPeriodEnd ?? s.modifiedAt) as string | Date | null | undefined;
			if (!raw) continue;
			const d = raw instanceof Date ? raw : new Date(raw);
			if (isNaN(d.getTime())) continue;
			if (!latest || d > latest) latest = d;
		}
		return latest;
	} catch {
		return null;
	}
}

export async function getEntitlementForUser(userId: string): Promise<Entitlement> {
	if (!SAAS_MODE) return UNLIMITED_ENTITLEMENT;

	const cached = cache.get(userId);
	if (cached && cached.expiresAt > Date.now()) return cached.ent;

	let ent: Entitlement = FREE_ENTITLEMENT;
	try {
		const { polarClient } = await import('$lib/server/saas/polar');
		const state = await polarClient.customers.getStateExternal({ externalId: userId });
		const active = (state as unknown as { activeSubscriptions?: Array<{ productId?: string; status: string }> }).activeSubscriptions ?? [];
		const activeSub = active.find((s) => s.status === 'active');
		if (activeSub?.productId) {
			// Try map first, then direct tier lookup by productId
			let slug = Object.entries(POLAR_PRODUCT_MAP).find(([, pid]) => pid === activeSub.productId)?.[0] ?? null;
			if (!slug) {
				const direct = PRICING_TIERS.find((t) => t.productId === activeSub.productId);
				if (direct) slug = direct.slug;
			}
			ent = entitlementForSlug(slug);
			// Fallback: active subscription exists but tier not configured -> grant starter limits instead of free
			if (!ent.hasSubscription) {
				console.warn('[entitlement] active subscription with unknown productId', activeSub.productId, 'available tiers', PRICING_TIERS.map((t) => t.productId));
				const fallback = PRICING_TIERS[0];
				if (fallback) ent = entitlementForSlug(fallback.slug);
			}
		} else {
			// No active subscription - check if they ever had one
			const lastEnd = await getLastSubscriptionEnd(userId);
			if (!lastEnd) {
				// Never subscribed -> free but dashboard NOT locked (so they can subscribe)
				ent = { ...FREE_ENTITLEMENT, dashboardLocked: false, graceDaysRemaining: null, expiredAt: null };
			} else {
				const daysSince = (Date.now() - lastEnd.getTime()) / (1000 * 60 * 60 * 24);
				const remaining = Math.ceil(GRACE_DAYS - daysSince);
				const locked = daysSince > GRACE_DAYS;
				ent = {
					...FREE_ENTITLEMENT,
					dashboardLocked: locked,
					graceDaysRemaining: locked ? 0 : Math.max(0, remaining),
					expiredAt: lastEnd
				};
			}
		}
	} catch {
		// 404 or network -> treat as never-subscribed free (dashboard open so they can subscribe)
		ent = { ...FREE_ENTITLEMENT, dashboardLocked: false, graceDaysRemaining: null, expiredAt: null };
	}

	cache.set(userId, { ent, expiresAt: Date.now() + CACHE_TTL_MS });
	return ent;
}

export function clearEntitlementCache(userId?: string) {
	if (userId) cache.delete(userId);
	else cache.clear();
}