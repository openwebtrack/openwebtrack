import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { analyticsSession, pageview, visitor, analyticsEvent } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';

const escapeCSV = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
};

export const GET: RequestHandler = async ({ locals, params }) => {
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

	const [sessions, pageviews, events, visitors] = await Promise.all([
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

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv;charset=utf-8;',
			'Content-Disposition': `attachment; filename="${site.domain.replace(/[^a-z0-9]/gi, '_')}_analytics_${new Date().toISOString().split('T')[0]}.csv"`
		}
	});
};
