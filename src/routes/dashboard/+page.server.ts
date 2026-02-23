import { website, visitor, pageview, teamMember } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import { eq, count, gte, and, lte, inArray, getTableColumns } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import db from '$lib/server/db';

interface SparklinePoint {
	value: number;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth?redirectTo=/dashboard');
	}

	const ownedWebsites = await db.select().from(website).where(eq(website.userId, locals.user.id));
	const ownedWebsiteIds = new Set(ownedWebsites.map((w) => w.id));

	const memberships = await db.select({ websiteId: teamMember.websiteId }).from(teamMember).where(eq(teamMember.userId, locals.user.id));

	const sharedWebsiteIds = memberships.map((m) => m.websiteId);

	let sharedWebsites: (typeof website.$inferSelect & {
		owner?: { name: string; email: string; image: string | null; createdAt: Date };
	})[] = [];
	if (sharedWebsiteIds.length > 0) {
		const sites = await db
			.select({
				...getTableColumns(website),
				ownerName: user.name,
				ownerEmail: user.email,
				ownerImage: user.image,
				ownerCreatedAt: user.createdAt
			})
			.from(website)
			.innerJoin(user, eq(website.userId, user.id))
			.where(inArray(website.id, sharedWebsiteIds));

		sharedWebsites = sites.map((site) => ({
			...site,
			owner: {
				name: site.ownerName,
				email: site.ownerEmail,
				image: site.ownerImage,
				createdAt: site.ownerCreatedAt
			}
		}));
	}

	const now = new Date();
	const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const websitesWithStats = await Promise.all(
		[...ownedWebsites, ...sharedWebsites].map(async (site) => {
			const [visitorCount] = await db
				.select({ count: count() })
				.from(visitor)
				.where(and(eq(visitor.websiteId, site.id), gte(visitor.lastSeen, last24h)));

			const pageviews = await db
				.select({ timestamp: pageview.timestamp })
				.from(pageview)
				.where(and(eq(pageview.websiteId, site.id), gte(pageview.timestamp, last7d), lte(pageview.timestamp, now)));

			const sparklineData: SparklinePoint[] = [];
			for (let i = 6; i >= 0; i--) {
				const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				dayStart.setHours(0, 0, 0, 0);
				const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

				const count = pageviews.filter((pv) => {
					const t = pv.timestamp.getTime();
					return t >= dayStart.getTime() && t <= dayEnd.getTime();
				}).length;

				sparklineData.push({ value: count });
			}

			const isOwner = ownedWebsiteIds.has(site.id);

			return {
				...site,
				visitors24h: visitorCount?.count || 0,
				sparkline: sparklineData,
				isOwner,
				owner: 'owner' in site ? site.owner : undefined
			};
		})
	);

	return { user: locals.user, websites: websitesWithStats };
};
