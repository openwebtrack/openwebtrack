import { analyticsSession, payment, stripeIntegration, visitor, website } from '$lib/server/db/schema';
import { generateAvatarUrl, generateVisitorName } from '$lib/utils/visitor';
import { SESSION_EXPIRY_MINUTES } from '@/utils/constants';
import { decryptSecret } from './crypto';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import db from '$lib/server/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Metadata keys we accept for attribution (ours first, DataFast compat after). */
const VISITOR_KEYS = ['owt_visitor_id', 'openwebtrack_visitor_id', 'datafast_visitor_id'];
const SESSION_KEYS = ['owt_session_id', 'openwebtrack_session_id', 'datafast_session_id'];

export interface Attribution {
	visitorId: string | null;
	sessionId: string | null;
}

export function extractAttribution(metadata?: Record<string, unknown> | null, clientReferenceId?: string | null): Attribution {
	let visitorId: string | null = null;
	let sessionId: string | null = null;

	if (metadata) {
		for (const k of VISITOR_KEYS) {
			const v = metadata[k];
			if (typeof v === 'string' && UUID_RE.test(v.trim())) {
				visitorId = v.trim();
				break;
			}
		}
		for (const k of SESSION_KEYS) {
			const v = metadata[k];
			if (typeof v === 'string' && UUID_RE.test(v.trim())) {
				sessionId = v.trim();
				break;
			}
		}
	}

	// Fallback: client_reference_id documented as "visitorId:sessionId"
	if ((!visitorId || !sessionId) && clientReferenceId && clientReferenceId.includes(':')) {
		const [v, s] = clientReferenceId.split(':').map((p) => p.trim());
		if (!visitorId && v && UUID_RE.test(v)) visitorId = v;
		if (!sessionId && s && UUID_RE.test(s)) sessionId = s;
	}

	return { visitorId, sessionId };
}

export function buildStripeWebhookUrl(origin: string, websiteId: string): string {
	return `${origin.replace(/\/$/, '')}/api/revenue/webhooks/stripe/${websiteId}`;
}

/** Events our webhook endpoint subscribes to (must match the handler). */
export const STRIPE_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'payment_intent.succeeded',
	'charge.succeeded',
	'invoice.paid',
	'invoice.payment_succeeded'
];

export interface StripeWebhookEnsureResult {
	status: 'created' | 'exists' | 'failed';
	endpointId: string | null;
	/** Signing secret — only available when the endpoint was just created. */
	secret: string | null;
	error?: string;
}

/**
 * Auto-create (or adopt) the Stripe webhook endpoint for our URL.
 * Reuses an existing endpoint with the same URL when present so reconnects
 * never create duplicates; re-enables it and refreshes the event list.
 * The signing secret is only returned by Stripe on creation.
 */
export async function ensureStripeWebhook(secretKey: string, url: string): Promise<StripeWebhookEnsureResult> {
	const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });

	let existing: Stripe.WebhookEndpoint | null = null;
	try {
		const list = await stripe.webhookEndpoints.list({ limit: 100 });
		existing = list.data.find((e) => e.url === url) ?? null;
	} catch (e) {
		return { status: 'failed', endpointId: null, secret: null, error: e instanceof Error ? e.message : 'Failed to list webhook endpoints' };
	}

	if (existing) {
		try {
			await stripe.webhookEndpoints.update(existing.id, { disabled: false, enabled_events: STRIPE_WEBHOOK_EVENTS });
		} catch {
			// Non-fatal: endpoint exists, event refresh is best-effort.
		}
		return { status: 'exists', endpointId: existing.id, secret: null };
	}

	try {
		const created = await stripe.webhookEndpoints.create({
			url,
			enabled_events: STRIPE_WEBHOOK_EVENTS,
			description: 'OpenWebTrack revenue attribution'
		});
		return { status: 'created', endpointId: created.id, secret: created.secret ?? null };
	} catch (e) {
		return { status: 'failed', endpointId: null, secret: null, error: e instanceof Error ? e.message : 'Failed to create webhook endpoint' };
	}
}

/** Best-effort removal of a previously auto-created endpoint. Never throws. */
export async function deleteStripeWebhook(secretKey: string, endpointId: string): Promise<void> {
	try {
		const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
		await stripe.webhookEndpoints.del(endpointId);
	} catch (e) {
		console.error('[stripe] failed to delete webhook endpoint:', e instanceof Error ? e.message : e);
	}
}

export async function getStripeCredentials(websiteId: string): Promise<{ secretKey: string; webhookSecret: string | null; integrationId: string } | null> {
	const [row] = await db.select().from(stripeIntegration).where(eq(stripeIntegration.websiteId, websiteId)).limit(1);
	if (!row) return null;
	try {
		return {
			secretKey: decryptSecret(row.encryptedSecretKey),
			webhookSecret: row.encryptedWebhookSecret ? decryptSecret(row.encryptedWebhookSecret) : null,
			integrationId: row.id
		};
	} catch (e) {
		await db.update(stripeIntegration).set({ status: 'error', lastError: 'Failed to decrypt stored credentials' }).where(eq(stripeIntegration.id, row.id));
		throw e;
	}
}

/**
 * Ensure the attributed visitor/session exist for this website.
 * Creates minimal rows when the tracker IDs are valid UUIDs but unknown
 * (e.g. cookie cleared, ad-blocked pageview, cross-device checkout).
 * Falls back to a fresh unattributed visitor/session so revenue is never lost.
 */
export async function resolveVisitorAndSession(websiteId: string, visitorId: string | null, sessionId: string | null): Promise<{ visitorId: string; sessionId: string }> {
	const now = new Date();

	let vid = visitorId && UUID_RE.test(visitorId) ? visitorId : null;
	let sid = sessionId && UUID_RE.test(sessionId) ? sessionId : null;

	if (!vid) {
		vid = crypto.randomUUID();
		await db.insert(visitor).values({
			id: vid,
			websiteId,
			firstSeen: now,
			lastSeen: now,
			name: generateVisitorName(vid),
			avatar: generateAvatarUrl(vid)
		});
	} else {
		const [existing] = await db
			.select({ id: visitor.id })
			.from(visitor)
			.where(and(eq(visitor.id, vid), eq(visitor.websiteId, websiteId)))
			.limit(1);
		if (!existing) {
			await db.insert(visitor).values({
				id: vid,
				websiteId,
				firstSeen: now,
				lastSeen: now,
				name: generateVisitorName(vid),
				avatar: generateAvatarUrl(vid)
			});
		} else {
			await db.update(visitor).set({ lastSeen: now }).where(eq(visitor.id, vid));
		}
	}

	if (!sid) {
		const expiry = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);
		try {
			const [created] = await db.insert(analyticsSession).values({ visitorId: vid, websiteId, startedAt: now, expiresAt: expiry, lastActivityAt: now }).returning({ id: analyticsSession.id });
			sid = created.id;
		} catch {
			// Extremely unlikely collision path: fetch latest session for visitor
			const [latest] = await db
				.select({ id: analyticsSession.id })
				.from(analyticsSession)
				.where(and(eq(analyticsSession.visitorId, vid), eq(analyticsSession.websiteId, websiteId)))
				.limit(1);
			if (!latest) throw new Error('Failed to create session for Stripe payment');
			sid = latest.id;
		}
	} else {
		const [existing] = await db.select({ id: analyticsSession.id, websiteId: analyticsSession.websiteId }).from(analyticsSession).where(eq(analyticsSession.id, sid)).limit(1);
		if (!existing || existing.websiteId !== websiteId) {
			const expiry = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);
			// Session id from tracker may collide with another website's row; insert with explicit id, fall back to generated one.
			try {
				const [created] = await db
					.insert(analyticsSession)
					.values({ id: sid, visitorId: vid, websiteId, startedAt: now, expiresAt: expiry, lastActivityAt: now })
					.returning({ id: analyticsSession.id });
				sid = created.id;
			} catch {
				const [created] = await db
					.insert(analyticsSession)
					.values({ visitorId: vid, websiteId, startedAt: now, expiresAt: expiry, lastActivityAt: now })
					.returning({ id: analyticsSession.id });
				sid = created.id;
			}
		} else {
			const expiry = new Date(now.getTime() + SESSION_EXPIRY_MINUTES * 60 * 1000);
			await db.update(analyticsSession).set({ lastActivityAt: now, expiresAt: expiry }).where(eq(analyticsSession.id, sid));
		}
	}

	return { visitorId: vid, sessionId: sid };
}

export interface StripePaymentInput {
	websiteId: string;
	visitorId: string | null;
	sessionId: string | null;
	amount: number;
	currency: string;
	transactionId: string;
	timestamp?: Date;
}

/** Insert a Stripe payment, deduplicated by (websiteId, transactionId). Returns 'inserted' | 'duplicate'. */
export async function recordStripePayment(input: StripePaymentInput): Promise<'inserted' | 'duplicate'> {
	const { websiteId } = input;
	const resolved = await resolveVisitorAndSession(websiteId, input.visitorId, input.sessionId);

	const [site] = await db.select({ id: website.id }).from(website).where(eq(website.id, websiteId)).limit(1);
	if (!site) throw new Error('Website not found');

	const [dup] = await db
		.select({ id: payment.id })
		.from(payment)
		.where(and(eq(payment.websiteId, websiteId), eq(payment.transactionId, input.transactionId)))
		.limit(1);
	if (dup) return 'duplicate';

	await db.insert(payment).values({
		websiteId,
		visitorId: resolved.visitorId,
		sessionId: resolved.sessionId,
		amount: Math.max(0, Math.round(input.amount)),
		currency: (input.currency || 'USD').toUpperCase().slice(0, 10),
		transactionId: input.transactionId.slice(0, 255),
		timestamp: input.timestamp ?? new Date()
	});

	await db
		.update(visitor)
		.set({ isCustomer: true })
		.where(and(eq(visitor.id, resolved.visitorId), eq(visitor.websiteId, websiteId)));

	return 'inserted';
}

export interface StripeBackfillResult {
	fetched: number;
	inserted: number;
	duplicates: number;
	skipped: number;
}

/**
 * Pull recent Checkout Sessions from the Stripe API and attribute them via
 * stored visitor/session metadata. Deduplicated by Stripe session id, so it
 * is safe to run on connect and to re-run any time.
 */
export async function backfillStripeCheckoutSessions(secretKey: string, websiteId: string, limit = 100): Promise<StripeBackfillResult> {
	const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });

	let inserted = 0;
	let duplicates = 0;
	let skipped = 0;
	let fetched = 0;
	let startingAfter: string | undefined;

	while (fetched < limit) {
		const pageSize = Math.min(100, limit - fetched);
		const page = await stripe.checkout.sessions.list({ limit: pageSize, starting_after: startingAfter });
		if (page.data.length === 0) break;

		for (const s of page.data) {
			fetched++;
			if (s.payment_status !== 'paid' || s.status !== 'complete') {
				skipped++;
				continue;
			}
			const amount = s.amount_total ?? 0;
			if (!amount || amount <= 0) {
				skipped++;
				continue;
			}
			const { visitorId, sessionId } = extractAttribution(s.metadata as Record<string, unknown> | null, s.client_reference_id);
			const result = await recordStripePayment({
				websiteId,
				visitorId,
				sessionId,
				amount,
				currency: s.currency ?? 'USD',
				transactionId: s.id,
				timestamp: s.created ? new Date(s.created * 1000) : new Date()
			});
			if (result === 'inserted') inserted++;
			else duplicates++;
		}

		if (!page.has_more) break;
		startingAfter = page.data[page.data.length - 1].id;
	}

	return { fetched, inserted, duplicates, skipped };
}
