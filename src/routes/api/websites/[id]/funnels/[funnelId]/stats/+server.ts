import { funnel, analyticsSession, pageview, analyticsEvent } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID, parseDateRange } from '$lib/server/utils';
import { eq, and, gte, lte, inArray, ilike } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');
	if (!isValidUUID(params.funnelId)) throw error(400, 'Invalid funnel ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');

	const [f] = await db
		.select()
		.from(funnel)
		.where(and(eq(funnel.id, params.funnelId), eq(funnel.websiteId, params.id)))
		.limit(1);

	if (!f) throw error(404, 'Funnel not found');

	const startParam = url.searchParams.get('start');
	const endParam = url.searchParams.get('end');

	const { start, end } = parseDateRange(startParam, endParam, access.site.timezone);

	const steps = f.steps;
	if (!steps || steps.length === 0) return json({ steps: [], conversionRate: 0 });

	let prevVisitorIds: string[] | null = null;

	const results: { name: string; type: string; value: string; visitors: number }[] = [];

	for (const step of steps) {
		// Short-circuit: if previous step had 0 visitors, all subsequent are 0
		if (prevVisitorIds !== null && prevVisitorIds.length === 0) {
			results.push({ ...step, visitors: 0 });
			continue;
		}

		const baseConditions = [eq(analyticsSession.websiteId, params.id), ...(prevVisitorIds !== null ? [inArray(analyticsSession.visitorId, prevVisitorIds)] : [])];

		let rows: { visitorId: string }[];

		if (step.type === 'page_visit') {
			rows = await db
				.selectDistinct({ visitorId: analyticsSession.visitorId })
				.from(analyticsSession)
				.innerJoin(pageview, eq(pageview.sessionId, analyticsSession.id))
				.where(and(...baseConditions, gte(pageview.timestamp, start), lte(pageview.timestamp, end), ilike(pageview.pathname, step.value)));
		} else {
			rows = await db
				.selectDistinct({ visitorId: analyticsSession.visitorId })
				.from(analyticsSession)
				.innerJoin(analyticsEvent, eq(analyticsEvent.sessionId, analyticsSession.id))
				.where(and(...baseConditions, gte(analyticsEvent.timestamp, start), lte(analyticsEvent.timestamp, end), eq(analyticsEvent.name, step.value)));
		}

		prevVisitorIds = rows.map((r) => r.visitorId);
		results.push({ ...step, visitors: prevVisitorIds.length });
	}

	const firstCount = results[0]?.visitors ?? 0;
	const lastCount = results[results.length - 1]?.visitors ?? 0;
	const conversionRate = firstCount > 0 ? parseFloat(((lastCount / firstCount) * 100).toFixed(1)) : 0;

	return json({ steps: results, conversionRate });
};
