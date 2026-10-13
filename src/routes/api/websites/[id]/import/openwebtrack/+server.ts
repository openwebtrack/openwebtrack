import { analyticsSession, pageview, visitor, analyticsEvent, payment, funnel, website } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { backupImportSchema, validateBody } from '$lib/server/validation';
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { SAAS_MODE } from '$lib/config';
import { isGeneratedAvatar } from '$lib/utils/avatar';
import { generateAvatarUrl } from '$lib/utils/visitor';
import db from '$lib/server/db';

const INSERT_BATCH = 500;
// Same cap the website settings form enforces, so repeated imports can't grow these lists without bound.
const MAX_EXCLUSIONS = 100;

/**
 * Maps an id from the source instance to a stable id on this website (UUIDv5-style).
 * Re-importing the same backup hits the same ids, so duplicates are skipped instead of
 * doubled, and the same backup can be loaded into several websites without collisions.
 */
const remapId = (websiteId: string, id: string): string => {
	const hash = createHash('sha1').update(`${websiteId}:${id}`).digest();
	hash[6] = (hash[6] & 0x0f) | 0x50;
	hash[8] = (hash[8] & 0x3f) | 0x80;
	const hex = hash.subarray(0, 16).toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Returns the subset of `ids` that already exist on this website, so orphaned rows can be skipped. */
const existingIds = async (table: typeof visitor | typeof analyticsSession, websiteId: string, ids: string[]): Promise<Set<string>> => {
	const unique = [...new Set(ids)];
	const found = new Set<string>();
	for (let i = 0; i < unique.length; i += INSERT_BATCH) {
		const rows = await db
			.select({ id: table.id })
			.from(table)
			.where(and(eq(table.websiteId, websiteId), inArray(table.id, unique.slice(i, i + INSERT_BATCH))));
		for (const row of rows) found.add(row.id);
	}
	return found;
};

/** Inserts rows in batches, ignoring ones already present. Returns how many were new. */
const insertRows = async <T>(rows: T[], insert: (batch: T[]) => Promise<unknown[]>): Promise<number> => {
	let inserted = 0;
	for (let i = 0; i < rows.length; i += INSERT_BATCH) {
		inserted += (await insert(rows.slice(i, i + INSERT_BATCH))).length;
	}
	return inserted;
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Forces a CORS preflight for any cross-site attempt, on top of SvelteKit's origin check.
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		throw error(415, 'Expected application/json');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) {
		throw error(404, 'Website not found');
	}

	if (!access.isOwner) {
		throw error(403, 'Only the website owner can import data');
	}

	const site = access.site;

	// SAAS: accounts without an event allowance can't track, so they can't import either.
	if (SAAS_MODE) {
		const { getEntitlementForUser } = await import('$lib/server/saas/entitlements');
		const ent = await getEntitlementForUser(site.userId);
		if (ent.maxEventsPerMonth === 0) {
			throw error(402, 'An active subscription is required to import data');
		}
	}

	const parsed = validateBody(backupImportSchema, await request.json().catch(() => null));
	if (!parsed.success) {
		throw error(400, `Invalid backup data: ${parsed.error}`);
	}
	const data = parsed.data;
	const map = (id: string) => remapId(site.id, id);

	const imported = { funnels: 0, visitors: 0, sessions: 0, pageviews: 0, events: 0, payments: 0 };
	let skipped = 0;

	if (data.website) {
		const union = (current: string[], incoming: string[]) => [...new Set([...current, ...incoming])].slice(0, MAX_EXCLUSIONS);
		await db
			.update(website)
			.set({
				excludedIps: union(site.excludedIps, data.website.excludedIps),
				excludedPaths: union(site.excludedPaths, data.website.excludedPaths),
				excludedCountries: union(site.excludedCountries, data.website.excludedCountries)
			})
			.where(eq(website.id, site.id));
	}

	imported.funnels = await insertRows(
		data.funnels.map((f) => ({ ...f, id: map(f.id), websiteId: site.id })),
		(batch) => db.insert(funnel).values(batch).onConflictDoNothing().returning({ id: funnel.id })
	);

	imported.visitors = await insertRows(
		data.visitors.map((v) => {
			const id = map(v.id);
			// Only keep avatars we generate; an arbitrary URL would be loaded by every dashboard viewer.
			const avatar = v.avatar && isGeneratedAvatar(v.avatar) ? v.avatar : generateAvatarUrl(id);
			return { ...v, id, avatar, websiteId: site.id };
		}),
		(batch) => db.insert(visitor).values(batch).onConflictDoNothing().returning({ id: visitor.id })
	);

	// Child rows are only inserted when their parents made it in; a backup taken while
	// traffic was arriving can contain a few rows whose parent was written after its table was read.
	const now = new Date();
	// Imported sessions are history: never let them count as live or be resumed by the tracker.
	const sessions = data.sessions.map((s) => ({
		...s,
		id: map(s.id),
		visitorId: map(s.visitorId),
		expiresAt: s.expiresAt > now ? now : s.expiresAt,
		websiteId: site.id
	}));
	const sessionVisitors = await existingIds(
		visitor,
		site.id,
		sessions.map((s) => s.visitorId)
	);
	const validSessions = sessions.filter((s) => sessionVisitors.has(s.visitorId));
	skipped += sessions.length - validSessions.length;
	imported.sessions = await insertRows(validSessions, (batch) => db.insert(analyticsSession).values(batch).onConflictDoNothing().returning({ id: analyticsSession.id }));

	const pageviews = data.pageviews.map((p) => ({ ...p, id: map(p.id), sessionId: map(p.sessionId), websiteId: site.id }));
	const events = data.events.map((e) => ({ ...e, id: map(e.id), sessionId: map(e.sessionId), websiteId: site.id }));
	const payments = data.payments.map((p) => ({ ...p, id: map(p.id), sessionId: map(p.sessionId), visitorId: map(p.visitorId), websiteId: site.id }));

	const knownSessions = await existingIds(
		analyticsSession,
		site.id,
		[...pageviews, ...events, ...payments].map((r) => r.sessionId)
	);
	const paymentVisitors = await existingIds(
		visitor,
		site.id,
		payments.map((p) => p.visitorId)
	);

	const validPageviews = pageviews.filter((p) => knownSessions.has(p.sessionId));
	const validEvents = events.filter((e) => knownSessions.has(e.sessionId));
	const validPayments = payments.filter((p) => knownSessions.has(p.sessionId) && paymentVisitors.has(p.visitorId));
	skipped += pageviews.length - validPageviews.length + events.length - validEvents.length + payments.length - validPayments.length;

	imported.pageviews = await insertRows(validPageviews, (batch) => db.insert(pageview).values(batch).onConflictDoNothing().returning({ id: pageview.id }));
	imported.events = await insertRows(validEvents, (batch) => db.insert(analyticsEvent).values(batch).onConflictDoNothing().returning({ id: analyticsEvent.id }));
	imported.payments = await insertRows(validPayments, (batch) => db.insert(payment).values(batch).onConflictDoNothing().returning({ id: payment.id }));

	return json({ success: true, imported, skipped });
};
