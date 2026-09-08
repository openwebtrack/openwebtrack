import { stripeClient } from '$lib/server/saas/stripe';

export async function ensureStripeCustomer(user: {
	id: string;
	email: string;
	name?: string | null;
}) {
	const db = (await import('$lib/server/db')).default;
	const { user: userTable } = await import('$lib/server/db/auth.schema');
	const { eq } = await import('drizzle-orm');

	const rows = await db
		.select({ stripeCustomerId: userTable.stripeCustomerId })
		.from(userTable)
		.where(eq(userTable.id, user.id))
		.limit(1);
	const existingId = rows[0]?.stripeCustomerId;
	if (existingId) {
		// Verify the customer still exists in Stripe; recreate if deleted
		try {
			await stripeClient.customers.retrieve(existingId);
			return { created: false };
		} catch {
			// fall through to create
		}
	}

	// Try to reuse a Stripe customer with the same email to avoid duplicates
	try {
		const found = await stripeClient.customers.list({ email: user.email, limit: 1 });
		const match = found.data[0];
		if (match) {
			await stripeClient.customers.update(match.id, {
				email: user.email,
				name: user.name ?? undefined,
				metadata: { userId: user.id }
			});
			await db
				.update(userTable)
				.set({ stripeCustomerId: match.id })
				.where(eq(userTable.id, user.id));
			return { created: false, linked: true };
		}
	} catch {
		// ignore lookup errors, create fresh
	}

	const customer = await stripeClient.customers.create({
		email: user.email,
		name: user.name ?? undefined,
		metadata: { userId: user.id }
	});
	await db
		.update(userTable)
		.set({ stripeCustomerId: customer.id })
		.where(eq(userTable.id, user.id));
	return { created: true };
}

/** @deprecated Use ensureStripeCustomer */
export const ensurePolarCustomer = ensureStripeCustomer;
