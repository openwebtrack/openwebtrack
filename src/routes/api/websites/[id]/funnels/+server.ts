import { funnel } from '$lib/server/db/schema';
import type { FunnelStepDef } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');

	const funnels = await db.select().from(funnel).where(eq(funnel.websiteId, params.id)).orderBy(desc(funnel.createdAt));

	return json(funnels);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { name, steps } = body as { name: string; steps: FunnelStepDef[] };

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}
	if (!Array.isArray(steps) || steps.length < 2) {
		return json({ error: 'At least 2 steps are required' }, { status: 400 });
	}
	for (const step of steps) {
		if (!step.name || !step.type || !step.value) {
			return json({ error: 'Each step must have name, type, and value' }, { status: 400 });
		}
		if (step.type !== 'page_visit' && step.type !== 'goal') {
			return json({ error: 'Step type must be page_visit or goal' }, { status: 400 });
		}
	}

	const [created] = await db.insert(funnel).values({ websiteId: params.id, name: name.trim(), steps }).returning();

	return json(created, { status: 201 });
};
