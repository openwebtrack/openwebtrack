import { createHash } from 'crypto';
import { and, count, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsEvent, analyticsSession, mcpKey, pageview, payment, teamMember, visitor, website } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID, parseDateRange } from '$lib/server/utils';

const textResult = (data: unknown, isError = false) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], isError });
const websiteIdSchema = z.string().uuid().describe('The website UUID returned by list_websites.');

const authenticateMcpKey = async (rawKey: string | undefined) => {
	if (!rawKey?.startsWith('owt_mcp_')) return null;
	const keyHash = createHash('sha256').update(rawKey).digest('hex');
	const [key] = await db.select({ id: mcpKey.id, userId: mcpKey.userId }).from(mcpKey).where(eq(mcpKey.keyHash, keyHash)).limit(1);
	if (!key) return null;
	db.update(mcpKey).set({ lastUsedAt: new Date() }).where(eq(mcpKey.id, key.id)).catch(() => {});
	return key.userId;
};

const listWebsites = (userId: string) => db.selectDistinct({ id: website.id, domain: website.domain, timezone: website.timezone, currency: website.currency, access: sql<'owner' | 'shared'>`CASE WHEN ${website.userId} = ${userId} THEN 'owner' ELSE 'shared' END` }).from(website).leftJoin(teamMember, eq(teamMember.websiteId, website.id)).where(or(eq(website.userId, userId), eq(teamMember.userId, userId))).orderBy(website.domain);
const dateRange = (startDate: string | undefined, endDate: string | undefined, timezone: string) => parseDateRange(startDate ?? null, endDate ?? null, timezone);
const toolLimit = (value: number | undefined) => Math.min(100, Math.max(1, value ?? 25));

const withWebsite = async (userId: string, websiteId: string) => {
	if (!isValidUUID(websiteId)) throw new Error('websiteId must be a valid UUID');
	const access = await checkWebsiteAccess(userId, websiteId);
	if (!access) throw new Error('Website not found or not shared with this account');
	return access.site;
};

const handler = withMcpAuth(
	createMcpHandler(
		(server) => {
			server.registerTool('list_websites', { title: 'List websites', description: 'List every website available to this account, including sites it owns and sites shared with it.', inputSchema: {}, annotations: { readOnlyHint: true } }, async (_args, extra) => {
				return textResult(await listWebsites(extra.authInfo!.clientId));
			});

			server.registerTool('analytics_overview', { title: 'Analytics overview', description: 'Get headline traffic, engagement, revenue, and top-page analytics for one accessible website.', inputSchema: { websiteId: websiteIdSchema, startDate: z.string().optional(), endDate: z.string().optional() }, annotations: { readOnlyHint: true } }, async ({ websiteId, startDate, endDate }, extra) => {
				try {
					const site = await withWebsite(extra.authInfo!.clientId, websiteId);
					const range = dateRange(startDate, endDate, site.timezone);
					const sessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, range.start), lte(analyticsSession.startedAt, range.end));
					const pageWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, range.start), lte(pageview.timestamp, range.end));
					const paymentWhere = and(eq(payment.websiteId, site.id), gte(payment.timestamp, range.start), lte(payment.timestamp, range.end));
					const [pageviews, sessions, visitors, revenue, topPages] = await Promise.all([
						db.select({ value: count() }).from(pageview).where(pageWhere), db.select({ value: count() }).from(analyticsSession).where(sessionWhere), db.select({ value: sql<number>`COUNT(DISTINCT ${analyticsSession.visitorId})` }).from(analyticsSession).where(sessionWhere), db.select({ value: sql<number>`COALESCE(SUM(${payment.amount}), 0)` }).from(payment).where(paymentWhere), db.select({ pathname: pageview.pathname, pageviews: count() }).from(pageview).where(pageWhere).groupBy(pageview.pathname).orderBy(desc(count())).limit(10)
					]);
					return textResult({ website: { id: site.id, domain: site.domain }, dateRange: { start: range.start.toISOString(), end: range.end.toISOString() }, pageviews: pageviews[0]?.value ?? 0, sessions: sessions[0]?.value ?? 0, uniqueVisitors: Number(visitors[0]?.value ?? 0), revenue: Number(revenue[0]?.value ?? 0), currency: site.currency, topPages });
				} catch (error) { return textResult({ error: error instanceof Error ? error.message : 'Tool call failed' }, true); }
			});

			server.registerTool('analytics_breakdown', { title: 'Analytics breakdown', description: 'Break down one accessible website by pages, referrers, countries, browsers, devices, event names, or campaigns.', inputSchema: { websiteId: websiteIdSchema, dimension: z.enum(['pages', 'referrers', 'countries', 'browsers', 'devices', 'event_names', 'campaigns']), startDate: z.string().optional(), endDate: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }, annotations: { readOnlyHint: true } }, async ({ websiteId, dimension, startDate, endDate, limit }, extra) => {
				try {
					const site = await withWebsite(extra.authInfo!.clientId, websiteId); const range = dateRange(startDate, endDate, site.timezone); const take = toolLimit(limit);
					const sessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, range.start), lte(analyticsSession.startedAt, range.end));
					const pageWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, range.start), lte(pageview.timestamp, range.end));
					const eventWhere = and(eq(analyticsEvent.websiteId, site.id), gte(analyticsEvent.timestamp, range.start), lte(analyticsEvent.timestamp, range.end));
					if (dimension === 'pages') return textResult(await db.select({ label: pageview.pathname, value: count() }).from(pageview).where(pageWhere).groupBy(pageview.pathname).orderBy(desc(count())).limit(take));
					if (dimension === 'referrers') return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsSession.referrer}, 'Direct')`, value: count() }).from(analyticsSession).where(sessionWhere).groupBy(analyticsSession.referrer).orderBy(desc(count())).limit(take));
					if (dimension === 'countries') return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsSession.country}, 'Unknown')`, value: count() }).from(analyticsSession).where(sessionWhere).groupBy(analyticsSession.country).orderBy(desc(count())).limit(take));
					if (dimension === 'browsers') return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsSession.browser}, 'Unknown')`, value: count() }).from(analyticsSession).where(sessionWhere).groupBy(analyticsSession.browser).orderBy(desc(count())).limit(take));
					if (dimension === 'devices') return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsSession.deviceType}, 'Unknown')`, value: count() }).from(analyticsSession).where(sessionWhere).groupBy(analyticsSession.deviceType).orderBy(desc(count())).limit(take));
					if (dimension === 'event_names') return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsEvent.name}, ${analyticsEvent.type})`, value: count() }).from(analyticsEvent).where(eventWhere).groupBy(analyticsEvent.name, analyticsEvent.type).orderBy(desc(count())).limit(take));
					return textResult(await db.select({ label: sql<string>`COALESCE(${analyticsSession.utmCampaign}, 'None')`, value: count() }).from(analyticsSession).where(sessionWhere).groupBy(analyticsSession.utmCampaign).orderBy(desc(count())).limit(take));
				} catch (error) { return textResult({ error: error instanceof Error ? error.message : 'Tool call failed' }, true); }
			});

			server.registerTool('analytics_records', { title: 'Analytics records', description: 'Retrieve recent records from one accessible website. Supports pageviews, events, sessions, payments, and visitors; results are capped at 100.', inputSchema: { websiteId: websiteIdSchema, dataset: z.enum(['pageviews', 'events', 'sessions', 'payments', 'visitors']), startDate: z.string().optional(), endDate: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }, annotations: { readOnlyHint: true } }, async ({ websiteId, dataset, startDate, endDate, limit }, extra) => {
				try {
					const site = await withWebsite(extra.authInfo!.clientId, websiteId); const range = dateRange(startDate, endDate, site.timezone); const take = toolLimit(limit);
					const sessionWhere = and(eq(analyticsSession.websiteId, site.id), gte(analyticsSession.startedAt, range.start), lte(analyticsSession.startedAt, range.end));
					const pageWhere = and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, range.start), lte(pageview.timestamp, range.end));
					const eventWhere = and(eq(analyticsEvent.websiteId, site.id), gte(analyticsEvent.timestamp, range.start), lte(analyticsEvent.timestamp, range.end));
					const paymentWhere = and(eq(payment.websiteId, site.id), gte(payment.timestamp, range.start), lte(payment.timestamp, range.end));
					if (dataset === 'pageviews') return textResult(await db.select({ url: pageview.url, pathname: pageview.pathname, title: pageview.title, referrer: pageview.referrer, timestamp: pageview.timestamp }).from(pageview).where(pageWhere).orderBy(desc(pageview.timestamp)).limit(take));
					if (dataset === 'events') return textResult(await db.select({ type: analyticsEvent.type, name: analyticsEvent.name, data: analyticsEvent.data, timestamp: analyticsEvent.timestamp }).from(analyticsEvent).where(eventWhere).orderBy(desc(analyticsEvent.timestamp)).limit(take));
					if (dataset === 'sessions') return textResult(await db.select({ startedAt: analyticsSession.startedAt, lastActivityAt: analyticsSession.lastActivityAt, referrer: analyticsSession.referrer, country: analyticsSession.country, city: analyticsSession.city, browser: analyticsSession.browser, os: analyticsSession.os, deviceType: analyticsSession.deviceType, utmSource: analyticsSession.utmSource, utmCampaign: analyticsSession.utmCampaign }).from(analyticsSession).where(sessionWhere).orderBy(desc(analyticsSession.startedAt)).limit(take));
					if (dataset === 'payments') return textResult(await db.select({ amount: payment.amount, currency: payment.currency, transactionId: payment.transactionId, timestamp: payment.timestamp }).from(payment).where(paymentWhere).orderBy(desc(payment.timestamp)).limit(take));
					return textResult(await db.select({ name: visitor.name, isCustomer: visitor.isCustomer, firstSeen: visitor.firstSeen, lastSeen: visitor.lastSeen }).from(visitor).where(eq(visitor.websiteId, site.id)).orderBy(desc(visitor.lastSeen)).limit(take));
				} catch (error) { return textResult({ error: error instanceof Error ? error.message : 'Tool call failed' }, true); }
			});
		},
		{ serverInfo: { name: 'OpenWebTrack', version: '0.1.6' }, instructions: 'Use list_websites first, then pass a returned websiteId to analytics tools.' },
		{ basePath: '/api', disableSse: true, verboseLogs: true, maxDuration: 60, sessionIdGenerator: undefined }
	),
	async (_request, bearerToken) => {
		const userId = await authenticateMcpKey(bearerToken);
		return userId ? { token: bearerToken!, clientId: userId, scopes: [] } : undefined;
	},
	{ required: true }
);

const validateOrigin = (request: Request, url: URL) => {
	const origin = request.headers.get('origin');
	return !origin || origin === url.origin;
};

export const GET: RequestHandler = async ({ request, url }) => validateOrigin(request, url) ? handler(request) : new Response('Invalid Origin', { status: 403 });
export const POST: RequestHandler = async ({ request, url }) => validateOrigin(request, url) ? handler(request) : new Response('Invalid Origin', { status: 403 });
