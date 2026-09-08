import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';

async function hasActiveSubscriptionForUser(userId: string): Promise<boolean> {
	const db = await (await import('$lib/server/db')).default;
	const { subscription } = await import('$lib/server/db/auth.schema');
	const { and, eq, inArray } = await import('drizzle-orm');
	const rows = await db
		.select({ status: subscription.status })
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, userId),
				inArray(subscription.status, ['active', 'trialing'])
			)
		)
		.limit(1);
	return rows.length > 0;
}

async function getActiveSubscriptionForUser(userId: string) {
	const db = await (await import('$lib/server/db')).default;
	const { subscription } = await import('$lib/server/db/auth.schema');
	const { and, eq, inArray } = await import('drizzle-orm');
	const rows = await db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.referenceId, userId),
				inArray(subscription.status, ['active', 'trialing'])
			)
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function requireActiveSubscription(event: RequestEvent) {
	if (!SAAS_MODE) return;

	const user = event.locals.user;
	if (!user) throw error(401, 'Unauthorized');

	if (!(await hasActiveSubscriptionForUser(user.id))) {
		throw error(402, 'Active subscription required');
	}
}

export async function getSubscription(event: RequestEvent) {
	if (!SAAS_MODE) return null;

	const user = event.locals.user;
	if (!user) return null;

	return await getActiveSubscriptionForUser(user.id);
}
