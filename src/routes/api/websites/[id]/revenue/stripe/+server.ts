import { stripeIntegration } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { buildStripeWebhookUrl, backfillStripeCheckoutSessions, ensureStripeWebhook, deleteStripeWebhook, getStripeCredentials } from '$lib/server/revenue/stripe-helpers';
import { encryptSecret, maskKeyLast4 } from '$lib/server/revenue/crypto';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import Stripe from 'stripe';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const connectSchema = z.object({
	secretKey: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? v : undefined))
		.refine((v) => !v || v.startsWith('sk_') || v.startsWith('rk_'), 'Must be a Stripe secret (sk_...) or restricted (rk_...) key'),
	webhookSecret: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? v : undefined))
		.refine((v) => !v || v.startsWith('whsec_'), 'Webhook secret must start with whsec_...')
});

async function verifySecretKey(secretKey: string): Promise<{ accountId: string | null }> {
	const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
	try {
		// No-arg retrieve returns the own account; typed as requiring an id in stripe v22, hence the cast.
		const retrieveOwn = stripe.accounts.retrieve as unknown as () => Promise<{ id?: string }>;
		const account = await retrieveOwn();
		return { accountId: typeof account.id === 'string' ? account.id : null };
	} catch {
		// Restricted keys without account access can still list checkout sessions.
		await stripe.checkout.sessions.list({ limit: 1 });
		return { accountId: null };
	}
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	const [row] = await db.select().from(stripeIntegration).where(eq(stripeIntegration.websiteId, params.id)).limit(1);
	const origin = env.ORIGIN || '';

	return json({
		connected: !!row,
		status: row?.status ?? null,
		secretKeyLast4: row?.secretKeyLast4 ?? null,
		hasWebhookSecret: !!row?.encryptedWebhookSecret,
		providerWebhookId: row?.providerWebhookId ?? null,
		stripeAccountId: row?.stripeAccountId ?? null,
		lastVerifiedAt: row?.lastVerifiedAt ?? null,
		lastSyncedAt: row?.lastSyncedAt ?? null,
		lastWebhookAt: row?.lastWebhookAt ?? null,
		lastError: row?.lastError ?? null,
		webhookUrl: buildStripeWebhookUrl(origin, params.id)
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = connectSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
	}

	const secretKey = parsed.data.secretKey?.trim() || null;
	const webhookSecret = parsed.data.webhookSecret?.trim() || null;

	if (!secretKey) {
		// Secret-only update (e.g. adding the webhook signing secret from the panel).
		const [existing] = await db.select({ id: stripeIntegration.id }).from(stripeIntegration).where(eq(stripeIntegration.websiteId, params.id)).limit(1);
		if (!existing || !webhookSecret) {
			return json({ error: 'Provide a restricted key (rk_... or sk_...)' }, { status: 400 });
		}
		await db
			.update(stripeIntegration)
			.set({ encryptedWebhookSecret: encryptSecret(webhookSecret), lastError: null, updatedAt: new Date() })
			.where(eq(stripeIntegration.id, existing.id));
		return json({ success: true });
	}

	let accountId: string | null = null;
	try {
		({ accountId } = await verifySecretKey(secretKey));
	} catch (e) {
		const message = e instanceof Stripe.errors.StripeAuthenticationError ? 'Stripe rejected this key (authentication failed)' : e instanceof Error ? e.message : 'Stripe key verification failed';
		return json({ error: message }, { status: 400 });
	}

	const now = new Date();
	const [existing] = await db.select({ id: stripeIntegration.id }).from(stripeIntegration).where(eq(stripeIntegration.websiteId, params.id)).limit(1);

	if (existing) {
		await db
			.update(stripeIntegration)
			.set({
				encryptedSecretKey: encryptSecret(secretKey),
				secretKeyLast4: maskKeyLast4(secretKey),
				...(webhookSecret ? { encryptedWebhookSecret: encryptSecret(webhookSecret) } : {}),
				status: 'active',
				stripeAccountId: accountId,
				lastVerifiedAt: now,
				lastError: null,
				updatedAt: now
			})
			.where(eq(stripeIntegration.id, existing.id));
	} else {
		await db.insert(stripeIntegration).values({
			websiteId: params.id,
			encryptedSecretKey: encryptSecret(secretKey),
			secretKeyLast4: maskKeyLast4(secretKey),
			encryptedWebhookSecret: webhookSecret ? encryptSecret(webhookSecret) : null,
			status: 'active',
			stripeAccountId: accountId,
			lastVerifiedAt: now
		});
	}

	const origin = env.ORIGIN || '';
	const webhookUrl = buildStripeWebhookUrl(origin, params.id);

	// Auto-create the webhook endpoint in Stripe (idempotent: adopts an
	// existing endpoint with the same URL). The signing secret is only
	// returned by Stripe on creation; otherwise the panel offers manual setup.
	const webhook = await ensureStripeWebhook(secretKey, webhookUrl);
	if (webhook.status === 'created' || webhook.status === 'exists') {
		await db
			.update(stripeIntegration)
			.set({
				providerWebhookId: webhook.endpointId,
				...(webhook.secret ? { encryptedWebhookSecret: encryptSecret(webhook.secret) } : {}),
				lastError: null,
				updatedAt: new Date()
			})
			.where(eq(stripeIntegration.websiteId, params.id));
	}

	// Connecting checks the key with Stripe (done above) and starts the backfill.
	let backfill: { fetched: number; inserted: number; duplicates: number; skipped: number } | null = null;
	try {
		backfill = await backfillStripeCheckoutSessions(secretKey, params.id, 100);
		await db.update(stripeIntegration).set({ lastSyncedAt: new Date(), status: 'active', lastError: null }).where(eq(stripeIntegration.websiteId, params.id));
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Backfill failed';
		await db.update(stripeIntegration).set({ lastError: message }).where(eq(stripeIntegration.websiteId, params.id));
	}

	return json({ success: true, stripeAccountId: accountId, webhookUrl, webhook: { status: webhook.status, endpointId: webhook.endpointId, error: webhook.error ?? null }, backfill });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	// Best-effort: remove the auto-created endpoint in Stripe first.
	try {
		const creds = await getStripeCredentials(params.id);
		const [row] = await db.select({ providerWebhookId: stripeIntegration.providerWebhookId }).from(stripeIntegration).where(eq(stripeIntegration.websiteId, params.id)).limit(1);
		if (creds && row?.providerWebhookId) {
			await deleteStripeWebhook(creds.secretKey, row.providerWebhookId);
		}
	} catch {
		// Ignore — local disconnect must always succeed.
	}

	await db.delete(stripeIntegration).where(eq(stripeIntegration.websiteId, params.id));
	return json({ success: true });
};
