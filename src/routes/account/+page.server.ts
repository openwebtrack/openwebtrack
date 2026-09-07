import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth?redirectTo=/account');
	}

	const providers = {
		emailAndPassword: true,
		google: !!(env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET)
	};

	const mcpServerUrl = `${(env.ORIGIN || url.origin).replace(/\/$/, '')}/api/mcp`;

	if (!SAAS_MODE) {
		return {
			user: locals.user,
			saasEnabled: false as const,
			tiers: [],
			providers,
			mcpServerUrl
		};
	}

	// Lazy import so non-SaaS builds don't need env vars
	const { PRICING_TIERS } = await import('$lib/server/saas/pricing');
	return {
		user: locals.user,
		saasEnabled: true as const,
		tiers: PRICING_TIERS.map((t) => ({
			slug: t.slug,
			productId: t.productId,
			name: t.name,
			price: t.price,
			featured: t.featured ?? false,
			maxWebsites: t.maxWebsites,
			maxEventsPerMonth: t.maxEventsPerMonth,
			maxMembersPerWebsite: t.maxMembersPerWebsite,
			features: t.features
		})),
		providers,
		mcpServerUrl
	};
};