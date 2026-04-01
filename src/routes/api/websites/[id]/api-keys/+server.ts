import { json, error } from '@sveltejs/kit';
import { createHash, randomBytes } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import db from '$lib/server/db';
import { apiKey } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { apiKeyCreateSchema, validateBody } from '$lib/server/validation';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isValidUUID(params.id)) throw error(400, 'Invalid website ID');

	const access = await checkWebsiteAccess(locals.user.id, params.id);
	if (!access) throw error(404, 'Website not found');
	if (!access.isOwner) throw error(403, 'Forbidden');

	const keys = await db
		.select({
			id: apiKey.id,
			name: apiKey.name,
			lastUsedAt: apiKey.lastUsedAt,
			createdAt: apiKey.createdAt
		})
		.from(apiKey)
		.where(eq(apiKey.websiteId, params.id))
		.orderBy(desc(apiKey.createdAt));

	return json(keys);
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

	const validation = validateBody(apiKeyCreateSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	}

	const rawKey = 'owt_' + randomBytes(32).toString('hex');
	const keyHash = createHash('sha256').update(rawKey).digest('hex');

	const [newKey] = await db
		.insert(apiKey)
		.values({
			websiteId: params.id,
			name: validation.data.name,
			keyHash
		})
		.returning({
			id: apiKey.id,
			name: apiKey.name,
			lastUsedAt: apiKey.lastUsedAt,
			createdAt: apiKey.createdAt
		});

	return json({ ...newKey, key: rawKey }, { status: 201 });
};
