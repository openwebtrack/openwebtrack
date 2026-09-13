import { stripeIntegration } from '$lib/server/db/schema';
import { isValidUUID } from '$lib/server/utils';
import { extractAttribution, getStripeCredentials, recordStripePayment } from '$lib/server/revenue/stripe-helpers';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import Stripe from 'stripe';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

interface NormalizedCharge {
	transactionId: string;
	amount: number;
	currency: string;
	metadata: Record<string, unknown> | null;
	clientReferenceId: string | null;
	created: number | null;
}

/** Map the Stripe events we care about to a common shape. Returns null for events to ignore. */
function normalizeEvent(event: Stripe.Event): NormalizedCharge | null {
	const type = event.type;

	if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
		const s = event.data.object as Stripe.Checkout.Session;
		if (s.payment_status !== 'paid') return null;
		const amount = s.amount_total ?? 0;
		if (!amount || amount <= 0) return null;
		return {
			transactionId: s.id,
			amount,
			currency: s.currency ?? 'USD',
			metadata: (s.metadata ?? null) as Record<string, unknown> | null,
			clientReferenceId: s.client_reference_id ?? null,
			created: s.created ?? null
		};
	}

	if (type === 'payment_intent.succeeded') {
		const pi = event.data.object as Stripe.PaymentIntent;
		const amount = pi.amount_received ?? pi.amount ?? 0;
		if (!amount || amount <= 0) return null;
		return {
			transactionId: pi.id,
			amount,
			currency: pi.currency ?? 'USD',
			metadata: (pi.metadata ?? null) as Record<string, unknown> | null,
			clientReferenceId: null,
			created: pi.created ?? null
		};
	}

	if (type === 'charge.succeeded') {
		const ch = event.data.object as Stripe.Charge;
		if (ch.paid === false || ch.status !== 'succeeded') return null;
		if (!ch.amount || ch.amount <= 0) return null;
		return {
			transactionId: ch.id,
			amount: ch.amount,
			currency: ch.currency ?? 'USD',
			metadata: (ch.metadata ?? null) as Record<string, unknown> | null,
			clientReferenceId: null,
			created: ch.created ?? null
		};
	}

	if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
		const inv = event.data.object as Stripe.Invoice;
		const amount = (inv as { amount_paid?: number }).amount_paid ?? 0;
		if (!amount || amount <= 0) return null;
		return {
			transactionId: inv.id ?? `inv_${event.id}`,
			amount,
			currency: inv.currency ?? 'USD',
			metadata: (inv.metadata ?? null) as Record<string, unknown> | null,
			clientReferenceId: null,
			created: (inv as { created?: number }).created ?? null
		};
	}

	return null;
}

export const POST: RequestHandler = async ({ params, request }) => {
	const websiteId = params.websiteId;

	if (!isValidUUID(websiteId)) {
		return json({ error: 'Invalid website ID' }, { status: 400 });
	}

	const creds = await getStripeCredentials(websiteId);
	if (!creds) {
		return json({ error: 'Stripe not connected for this website' }, { status: 404 });
	}

	const rawBody = await request.text();
	const signature = request.headers.get('stripe-signature');

	let event: Stripe.Event;
	try {
		if (creds.webhookSecret && signature) {
			const stripe = new Stripe(creds.secretKey, { apiVersion: '2026-08-26.dahlia' });
			event = stripe.webhooks.constructEvent(rawBody, signature, creds.webhookSecret);
		} else if (creds.webhookSecret && !signature) {
			return json({ error: 'Missing stripe-signature header' }, { status: 400 });
		} else {
			// No webhook secret configured (testing mode): trust the parsed body.
			event = JSON.parse(rawBody) as Stripe.Event;
			if (!event?.type || !event?.data) throw new Error('Invalid Stripe event payload');
		}
	} catch (e) {
		console.error('[stripe-webhook] signature/payload verification failed:', e instanceof Error ? e.message : e);
		return json({ error: 'Webhook verification failed' }, { status: 400 });
	}

	const normalized = normalizeEvent(event);
	if (!normalized) {
		// Event type we don't track (e.g. subscription updates) — ack to stop retries.
		return json({ success: true, ignored: event.type });
	}

	try {
		const { visitorId, sessionId } = extractAttribution(normalized.metadata, normalized.clientReferenceId);
		const result = await recordStripePayment({
			websiteId,
			visitorId,
			sessionId,
			amount: normalized.amount,
			currency: normalized.currency,
			transactionId: normalized.transactionId,
			timestamp: normalized.created ? new Date(normalized.created * 1000) : new Date()
		});

		await db.update(stripeIntegration).set({ lastWebhookAt: new Date(), status: 'active', lastError: null }).where(eq(stripeIntegration.websiteId, websiteId));

		return json({ success: true, result, transactionId: normalized.transactionId });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to record payment';
		console.error('[stripe-webhook] failed to record payment:', message);
		await db.update(stripeIntegration).set({ lastError: message }).where(eq(stripeIntegration.websiteId, websiteId));
		// Return 200 with error flag so Stripe doesn't retry a poison payload forever;
		// validation/signature errors above still return 4xx.
		return json({ success: false, error: message }, { status: 200 });
	}
};
