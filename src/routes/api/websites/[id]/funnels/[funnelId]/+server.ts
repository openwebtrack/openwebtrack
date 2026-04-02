import { funnel } from '$lib/server/db/schema';
import type { FunnelStepDef } from '$lib/server/db/schema';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';

export const GET: RequestHandler = async ({ locals, params }) => {
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

	return json(f);
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');
	if (!isValidUUID(params.funnelId)) throw error(400, 'Invalid funnel ID');

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

	const [updated] = await db
		.update(funnel)
		.set({ name: name.trim(), steps })
		.where(and(eq(funnel.id, params.funnelId), eq(funnel.websiteId, params.id)))
		.returning();

	if (!updated) throw error(404, 'Funnel not found');

	return json(updated);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');
	if (!isValidUUID(params.funnelId)) throw error(400, 'Invalid funnel ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');

	await db.delete(funnel).where(and(eq(funnel.id, params.funnelId), eq(funnel.websiteId, params.id)));

	return json({ success: true });
};
