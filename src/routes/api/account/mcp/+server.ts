import { error, json } from '@sveltejs/kit';
import { createHash, randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { mcpKey } from '$lib/server/db/schema';
import { apiKeyCreateSchema, validateBody } from '$lib/server/validation';

const requireUser = (userId: string | undefined) => {
	if (!userId) throw error(401, 'Unauthorized');
	return userId;
};

export const GET: RequestHandler = async ({ locals }) => {
	const userId = requireUser(locals.user?.id);
	const keys = await db.select({ id: mcpKey.id, name: mcpKey.name, lastUsedAt: mcpKey.lastUsedAt, createdAt: mcpKey.createdAt }).from(mcpKey).where(eq(mcpKey.userId, userId)).orderBy(desc(mcpKey.createdAt));
	return json({ keys });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = requireUser(locals.user?.id);
	const body = await request.json().catch(() => null);
	const validation = validateBody(apiKeyCreateSchema, body);
	if (!validation.success) return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	const key = `owt_mcp_${randomBytes(32).toString('hex')}`;
	const keyHash = createHash('sha256').update(key).digest('hex');
	const [created] = await db.insert(mcpKey).values({ userId, name: validation.data.name, keyHash }).returning({ id: mcpKey.id, name: mcpKey.name, lastUsedAt: mcpKey.lastUsedAt, createdAt: mcpKey.createdAt });
	return json({ ...created, key }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	const userId = requireUser(locals.user?.id);
	const keyId = url.searchParams.get('keyId');
	if (!keyId) return json({ error: 'Key ID is required' }, { status: 400 });
	await db.delete(mcpKey).where(and(eq(mcpKey.id, keyId), eq(mcpKey.userId, userId)));
	return new Response(null, { status: 204 });
};
