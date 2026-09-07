import { polarClient } from '$lib/server/saas/polar';

export async function ensurePolarCustomer(user: { id: string; email: string; name?: string | null }) {
	try {
		await polarClient.customers.getStateExternal({ externalId: user.id });
		return { created: false };
	} catch {
		// Not found -> try to find by email to link, or create fresh
		try {
			const { result } = await polarClient.customers.list({ email: user.email });
			const existing = (result as { items: Array<{ id: string }> }).items[0];
			if (existing) {
				await polarClient.customers.update({
					id: existing.id,
					customerUpdate: { externalId: user.id, email: user.email, name: user.name ?? undefined }
				});
				return { created: false, linked: true };
			}
		} catch {}
		await polarClient.customers.create({
			externalId: user.id,
			email: user.email,
			name: user.name ?? undefined
		});
		return { created: true };
	}
}