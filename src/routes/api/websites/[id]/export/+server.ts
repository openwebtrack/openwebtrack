import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsSession, pageview, visitor, analyticsEvent, payment, funnel, website } from '$lib/server/db/schema';
import { eq, desc, and, gt, asc, getTableColumns } from 'drizzle-orm';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupSection } from '$lib/backup';

const BACKUP_PAGE_SIZE = 2000;

// Every column except websiteId — the importing instance assigns its own.
const withoutWebsiteId = <T extends { websiteId: unknown }>(columns: T): Omit<T, 'websiteId'> => {
	const { websiteId: _, ...rest } = columns;
	return rest;
};

const backupTables = {
	funnels: funnel,
	visitors: visitor,
	sessions: analyticsSession,
	pageviews: pageview,
	events: analyticsEvent,
	payments: payment
} satisfies Record<BackupSection, unknown>;

/** Yields JSON-encoded rows of one table, paging by primary key so memory stays flat on large sites. */
async function* backupRows(section: BackupSection, websiteId: string): AsyncGenerator<string> {
	const table = backupTables[section] as typeof visitor;
	const columns = withoutWebsiteId(getTableColumns(table));
	let after: string | null = null;
	let first = true;

	while (true) {
		const rows: { id: string }[] = await db
			.select(columns)
			.from(table)
			.where(after ? and(eq(table.websiteId, websiteId), gt(table.id, after)) : eq(table.websiteId, websiteId))
			.orderBy(asc(table.id))
			.limit(BACKUP_PAGE_SIZE);

		if (rows.length > 0) {
			yield (first ? '' : ',') + rows.map((row) => JSON.stringify(row)).join(',');
			first = false;
		}
		if (rows.length < BACKUP_PAGE_SIZE) return;
		after = rows[rows.length - 1].id;
	}
}

async function* backupChunks(site: typeof website.$inferSelect): AsyncGenerator<string> {
	const settings = {
		domain: site.domain,
		timezone: site.timezone,
		currency: site.currency,
		excludedIps: site.excludedIps,
		excludedPaths: site.excludedPaths,
		excludedCountries: site.excludedCountries,
		extraDomains: site.extraDomains
	};

	yield `{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"exportedAt":${JSON.stringify(new Date().toISOString())},"website":${JSON.stringify(settings)}`;
	for (const section of Object.keys(backupTables) as BackupSection[]) {
		yield `,${JSON.stringify(section)}:[`;
		yield* backupRows(section, site.id);
		yield ']';
	}
	yield '}';
}

const backupResponse = (site: typeof website.$inferSelect) => {
	const chunks = backupChunks(site);
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await chunks.next();
				if (done) controller.close();
				else controller.enqueue(encoder.encode(value));
			} catch (e) {
				console.error('Backup export failed:', e);
				controller.error(e);
			}
		},
		async cancel() {
			await chunks.return(undefined);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'Content-Disposition': `attachment; filename="${site.domain.replace(/[^a-z0-9]/gi, '_')}_openwebtrack_${new Date().toISOString().split('T')[0]}.json"`
		}
	});
};

const escapeCSV = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
};

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!isValidUUID(params.id)) {
		throw error(400, 'Invalid website ID');
	}

	const access = await checkWebsiteAccess(locals.user.id, params.id);

	if (!access) {
		throw error(404, 'Website not found');
	}

	if (!access.isOwner) {
		throw error(403, 'Only the website owner can export data');
	}

	const site = access.site;

	if (url.searchParams.get('format') === 'json') {
		return backupResponse(site);
	}

	const [sessions, pageviews, events, visitors, payments] = await Promise.all([
		db
			.select({
				id: analyticsSession.id,
				visitorId: analyticsSession.visitorId,
				startedAt: analyticsSession.startedAt,
				lastActivityAt: analyticsSession.lastActivityAt,
				referrer: analyticsSession.referrer,
				utmSource: analyticsSession.utmSource,
				utmMedium: analyticsSession.utmMedium,
				utmCampaign: analyticsSession.utmCampaign,
				browser: analyticsSession.browser,
				browserVersion: analyticsSession.browserVersion,
				os: analyticsSession.os,
				osVersion: analyticsSession.osVersion,
				deviceType: analyticsSession.deviceType,
				screenWidth: analyticsSession.screenWidth,
				screenHeight: analyticsSession.screenHeight,
				language: analyticsSession.language,
				timezone: analyticsSession.timezone,
				country: analyticsSession.country,
				region: analyticsSession.region,
				city: analyticsSession.city,
				isPwa: analyticsSession.isPwa
			})
			.from(analyticsSession)
			.where(eq(analyticsSession.websiteId, site.id))
			.orderBy(desc(analyticsSession.startedAt))
			.limit(10000),
		db
			.select({
				id: pageview.id,
				sessionId: pageview.sessionId,
				url: pageview.url,
				pathname: pageview.pathname,
				referrer: pageview.referrer,
				title: pageview.title,
				viewportWidth: pageview.viewportWidth,
				viewportHeight: pageview.viewportHeight,
				timestamp: pageview.timestamp
			})
			.from(pageview)
			.where(eq(pageview.websiteId, site.id))
			.orderBy(desc(pageview.timestamp))
			.limit(10000),
		db
			.select({
				id: analyticsEvent.id,
				sessionId: analyticsEvent.sessionId,
				type: analyticsEvent.type,
				name: analyticsEvent.name,
				data: analyticsEvent.data,
				timestamp: analyticsEvent.timestamp
			})
			.from(analyticsEvent)
			.where(eq(analyticsEvent.websiteId, site.id))
			.orderBy(desc(analyticsEvent.timestamp))
			.limit(10000),
		db
			.select({
				id: visitor.id,
				name: visitor.name,
				avatar: visitor.avatar,
				firstSeen: visitor.firstSeen,
				lastSeen: visitor.lastSeen
			})
			.from(visitor)
			.where(eq(visitor.websiteId, site.id))
			.orderBy(desc(visitor.lastSeen))
			.limit(10000),
		db
			.select({
				id: payment.id,
				visitorId: payment.visitorId,
				sessionId: payment.sessionId,
				amount: payment.amount,
				currency: payment.currency,
				transactionId: payment.transactionId,
				timestamp: payment.timestamp
			})
			.from(payment)
			.where(eq(payment.websiteId, site.id))
			.orderBy(desc(payment.timestamp))
			.limit(10000)
	]);

	let csv = '';

	csv += 'VISITORS\n';
	csv += 'id,name,avatar,first_seen,last_seen\n';
	for (const v of visitors) {
		csv += `${escapeCSV(v.id)},${escapeCSV(v.name)},${escapeCSV(v.avatar)},${escapeCSV(v.firstSeen?.toISOString())},${escapeCSV(v.lastSeen?.toISOString())}\n`;
	}
	csv += '\n';

	csv += 'SESSIONS\n';
	csv +=
		'id,visitor_id,started_at,last_activity_at,referrer,utm_source,utm_medium,utm_campaign,browser,browser_version,os,os_version,device_type,screen_width,screen_height,language,timezone,country,region,city,is_pwa\n';
	for (const s of sessions) {
		csv += `${escapeCSV(s.id)},${escapeCSV(s.visitorId)},${escapeCSV(s.startedAt?.toISOString())},${escapeCSV(s.lastActivityAt?.toISOString())},${escapeCSV(s.referrer)},${escapeCSV(s.utmSource)},${escapeCSV(s.utmMedium)},${escapeCSV(s.utmCampaign)},${escapeCSV(s.browser)},${escapeCSV(s.browserVersion)},${escapeCSV(s.os)},${escapeCSV(s.osVersion)},${escapeCSV(s.deviceType)},${escapeCSV(s.screenWidth)},${escapeCSV(s.screenHeight)},${escapeCSV(s.language)},${escapeCSV(s.timezone)},${escapeCSV(s.country)},${escapeCSV(s.region)},${escapeCSV(s.city)},${escapeCSV(s.isPwa ? 'true' : 'false')}\n`;
	}
	csv += '\n';

	csv += 'PAGEVIEWS\n';
	csv += 'id,session_id,url,pathname,referrer,title,viewport_width,viewport_height,timestamp\n';
	for (const p of pageviews) {
		csv += `${escapeCSV(p.id)},${escapeCSV(p.sessionId)},${escapeCSV(p.url)},${escapeCSV(p.pathname)},${escapeCSV(p.referrer)},${escapeCSV(p.title)},${escapeCSV(p.viewportWidth)},${escapeCSV(p.viewportHeight)},${escapeCSV(p.timestamp?.toISOString())}\n`;
	}
	csv += '\n';

	csv += 'EVENTS\n';
	csv += 'id,session_id,type,name,data,timestamp\n';
	for (const e of events) {
		csv += `${escapeCSV(e.id)},${escapeCSV(e.sessionId)},${escapeCSV(e.type)},${escapeCSV(e.name)},${escapeCSV(e.data ? JSON.stringify(e.data) : null)},${escapeCSV(e.timestamp?.toISOString())}\n`;
	}
	csv += '\n';

	csv += 'PAYMENTS\n';
	csv += 'id,visitor_id,session_id,amount,currency,transaction_id,timestamp\n';
	for (const p of payments) {
		csv += `${escapeCSV(p.id)},${escapeCSV(p.visitorId)},${escapeCSV(p.sessionId)},${escapeCSV(p.amount)},${escapeCSV(p.currency)},${escapeCSV(p.transactionId)},${escapeCSV(p.timestamp?.toISOString())}\n`;
	}

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv;charset=utf-8;',
			'Cache-Control': 'private, no-store',
			'Content-Disposition': `attachment; filename="${site.domain.replace(/[^a-z0-9]/gi, '_')}_analytics_${new Date().toISOString().split('T')[0]}.csv"`
		}
	});
};
