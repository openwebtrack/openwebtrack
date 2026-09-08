import { SAAS_MODE } from '$lib/config';
import { PRICING_TIERS, getTierByPlanName } from '$lib/server/saas/pricing';

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

// Simple in-memory cache to avoid hitting the DB on every track request
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

type SubscriptionRow = {
	plan: string;
	status: string;
	referenceId: string;
	periodEnd: Date | null;
	endedAt: Date | null;
	canceledAt: Date | null;
	cancelAt: Date | null;
	cancelAtPeriodEnd: boolean | null;
};

async function getSubscriptionsForUser(userId: string): Promise<SubscriptionRow[]> {
	const db = (await import('$lib/server/db')).default;
	const { subscription } = await import('$lib/server/db/auth.schema');
	const { eq } = await import('drizzle-orm');
	const rows = await db
		.select({
			plan: subscription.plan,
			status: subscription.status,
			referenceId: subscription.referenceId,
			periodEnd: subscription.periodEnd,
			endedAt: subscription.endedAt,
			canceledAt: subscription.canceledAt,
			cancelAt: subscription.cancelAt,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
		})
		.from(subscription)
		.where(eq(subscription.referenceId, userId));
	return rows as SubscriptionRow[];
}

function getLastSubscriptionEnd(subs: SubscriptionRow[]): Date | null {
	if (!subs.length) return null;
	let latest: Date | null = null;
	for (const s of subs) {
		const raw = s.endedAt ?? s.periodEnd ?? s.cancelAt ?? s.canceledAt;
		if (!raw) continue;
		const d = raw instanceof Date ? raw : new Date(raw);
		if (isNaN(d.getTime())) continue;
		if (!latest || d > latest) latest = d;
	}
	return latest;
}

export async function getEntitlementForUser(userId: string): Promise<Entitlement> {
	if (!SAAS_MODE) return UNLIMITED_ENTITLEMENT;

	const cached = cache.get(userId);
	if (cached && cached.expiresAt > Date.now()) return cached.ent;

	let ent: Entitlement = FREE_ENTITLEMENT;
	try {
		const subs = await getSubscriptionsForUser(userId);
		const activeSub = subs.find((s) => s.status === 'active' || s.status === 'trialing');

		if (activeSub) {
			const tier = getTierByPlanName(activeSub.plan);
			ent = entitlementForSlug(tier?.slug ?? null);
			// Fallback: active subscription exists but tier not configured -> grant first tier limits instead of free
			if (!ent.hasSubscription) {
				console.warn(
					'[entitlement] active subscription with unknown plan',
					activeSub.plan,
					'available tiers',
					PRICING_TIERS.map((t) => t.slug)
				);
				const fallback = PRICING_TIERS[0];
				if (fallback) ent = entitlementForSlug(fallback.slug);
			}
		} else {
			// No active subscription - check if they ever had one
			const lastEnd = getLastSubscriptionEnd(subs);
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
		// DB error -> treat as never-subscribed free (dashboard open so they can subscribe)
		ent = { ...FREE_ENTITLEMENT, dashboardLocked: false, graceDaysRemaining: null, expiredAt: null };
	}

	cache.set(userId, { ent, expiresAt: Date.now() + CACHE_TTL_MS });
	return ent;
}

export function clearEntitlementCache(userId?: string) {
	if (userId) cache.delete(userId);
	else cache.clear();
}
