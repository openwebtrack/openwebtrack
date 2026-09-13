import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { website } from '$lib/server/db/schema';
import { eq, and, ne, inArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { checkWebsiteAccess, isValidUUID } from '$lib/server/utils';
import { websiteUpdateSchema, validateBody } from '$lib/server/validation';

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

	return json({ ...access.site, isOwner: access.isOwner });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
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
		throw error(403, 'Forbidden');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const validation = validateBody(websiteUpdateSchema, body);
	if (!validation.success) {
		return json({ error: validation.error, errors: validation.errors }, { status: 400 });
	}

	const { domain, timezone = access.site.timezone, currency = access.site.currency, extraDomains: rawExtraDomains, excludedIps, excludedPaths, excludedCountries, notifications } = validation.data;

	// Normalize additional domains: drop empties, the primary domain and duplicates.
	let extraDomains: string[] | undefined;
	if (rawExtraDomains !== undefined) {
		const primaryNorm = (domain ?? access.site.domain).toLowerCase();
		const seen = new Set<string>();
		extraDomains = [];
		for (const d of rawExtraDomains) {
			const norm = d.toLowerCase().trim();
			if (!norm || norm === primaryNorm || seen.has(norm)) continue;
			seen.add(norm);
			extraDomains.push(norm);
		}

		// An alias must not collide with another website's primary or alias domains.
		if (extraDomains.length > 0) {
			const [primaryClash] = await db
				.select({ domain: website.domain })
				.from(website)
				.where(and(inArray(website.domain, extraDomains), ne(website.id, params.id)))
				.limit(1);
			if (primaryClash) {
				return json({ error: `Domain "${primaryClash.domain}" is already registered as another website` }, { status: 409 });
			}
			for (const alias of extraDomains) {
				const [aliasClash] = await db
					.select({ domain: website.domain })
					.from(website)
					.where(and(sql`${website.extraDomains} ? ${alias}`, ne(website.id, params.id)))
					.limit(1);
				if (aliasClash) {
					return json({ error: `Domain "${alias}" is already added to "${aliasClash.domain}"` }, { status: 409 });
				}
			}
		}
	}

	const updateData: Record<string, unknown> = { domain, timezone, currency };
	if (extraDomains !== undefined) updateData.extraDomains = extraDomains;
	if (excludedIps !== undefined) updateData.excludedIps = excludedIps;
	if (excludedPaths !== undefined) updateData.excludedPaths = excludedPaths;
	if (excludedCountries !== undefined) updateData.excludedCountries = excludedCountries;
	if (notifications !== undefined) updateData.notifications = notifications;

	const [updated] = await db.update(website).set(updateData).where(eq(website.id, params.id)).returning();

	return json(updated);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
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
		throw error(403, 'Forbidden');
	}

	await db.delete(website).where(eq(website.id, params.id));

	return json({ success: true });
};
