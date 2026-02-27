import { pgTable, integer, text, timestamp, jsonb, index, uuid, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const website = pgTable(
	'website',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		domain: text('domain').notNull().unique(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		timezone: text('timezone').notNull().default('UTC'),
		excludedIps: jsonb('excluded_ips').$type<string[]>().default([]).notNull(),
		excludedPaths: jsonb('excluded_paths').$type<string[]>().default([]).notNull(),
		excludedCountries: jsonb('excluded_countries').$type<string[]>().default([]).notNull(),
		notifications: jsonb('notifications')
			.$type<{
				trafficSpike: { enabled: boolean; threshold: number; windowSeconds: number };
				weeklySummary: { enabled: boolean };
			}>()
			.default({
				trafficSpike: { enabled: false, threshold: 100, windowSeconds: 60 },
				weeklySummary: { enabled: false }
			})
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('website_userId_idx').on(table.userId), index('website_domain_idx').on(table.domain)]
);

export const teamMember = pgTable(
	'team_member',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		websiteId: uuid('website_id')
			.notNull()
			.references(() => website.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('teamMember_websiteId_idx').on(table.websiteId), index('teamMember_userId_idx').on(table.userId), index('teamMember_website_user_idx').on(table.websiteId, table.userId)]
);

export const visitor = pgTable(
	'visitor',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		websiteId: uuid('website_id')
			.notNull()
			.references(() => website.id, { onDelete: 'cascade' }),
		name: text('name'),
		avatar: text('avatar'),
		firstSeen: timestamp('first_seen').defaultNow().notNull(),
		lastSeen: timestamp('last_seen').defaultNow().notNull()
	},
	(table) => [index('visitor_websiteId_idx').on(table.websiteId), index('visitor_website_lastSeen_idx').on(table.websiteId, table.lastSeen)]
);

export const analyticsSession = pgTable(
	'analytics_session',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		visitorId: uuid('visitor_id')
			.notNull()
			.references(() => visitor.id, { onDelete: 'cascade' }),
		websiteId: uuid('website_id')
			.notNull()
			.references(() => website.id, { onDelete: 'cascade' }),
		startedAt: timestamp('started_at').defaultNow().notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
		referrer: text('referrer'),
		utmSource: text('utm_source'),
		utmMedium: text('utm_medium'),
		utmCampaign: text('utm_campaign'),
		screenWidth: integer('screen_width'),
		screenHeight: integer('screen_height'),
		language: text('language'),
		timezone: text('timezone'),
		browser: text('browser'),
		browserVersion: text('browser_version'),
		os: text('os'),
		osVersion: text('os_version'),
		deviceType: text('device_type'),
		isPwa: boolean('is_pwa').default(false),
		country: text('country'),
		region: text('region'),
		city: text('city')
	},
	(table) => [
		index('analyticsSession_websiteId_idx').on(table.websiteId),
		index('analyticsSession_visitorId_idx').on(table.visitorId),
		index('analyticsSession_expiresAt_idx').on(table.expiresAt),
		index('analyticsSession_lastActivityAt_idx').on(table.lastActivityAt),
		index('analyticsSession_browser_idx').on(table.browser),
		index('analyticsSession_os_idx').on(table.os),
		index('analyticsSession_deviceType_idx').on(table.deviceType),
		index('analyticsSession_country_idx').on(table.country),
		index('analyticsSession_region_idx').on(table.region),
		index('analyticsSession_city_idx').on(table.city),
		index('analyticsSession_website_started_idx').on(table.websiteId, table.startedAt),
		index('analyticsSession_website_activity_idx').on(table.websiteId, table.lastActivityAt)
	]
);

export const pageview = pgTable(
	'pageview',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => analyticsSession.id, { onDelete: 'cascade' }),
		websiteId: uuid('website_id')
			.notNull()
			.references(() => website.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		pathname: text('pathname').notNull(),
		referrer: text('referrer'),
		title: text('title'),
		viewportWidth: integer('viewport_width'),
		viewportHeight: integer('viewport_height'),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => [
		index('pageview_websiteId_idx').on(table.websiteId),
		index('pageview_sessionId_idx').on(table.sessionId),
		index('pageview_timestamp_idx').on(table.timestamp),
		index('pageview_title_idx').on(table.title),
		index('pageview_website_timestamp_idx').on(table.websiteId, table.timestamp),
		index('pageview_website_referrer_idx').on(table.websiteId, table.referrer)
	]
);

export const analyticsEvent = pgTable(
	'analytics_event',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => analyticsSession.id, { onDelete: 'cascade' }),
		websiteId: uuid('website_id')
			.notNull()
			.references(() => website.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		name: text('name'),
		data: jsonb('data').$type<Record<string, unknown>>(),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => [
		index('analyticsEvent_websiteId_idx').on(table.websiteId),
		index('analyticsEvent_sessionId_idx').on(table.sessionId),
		index('analyticsEvent_type_idx').on(table.type),
		index('analyticsEvent_timestamp_idx').on(table.timestamp),
		index('analyticsEvent_website_timestamp_idx').on(table.websiteId, table.timestamp),
		index('analyticsEvent_website_type_name_idx').on(table.websiteId, table.type, table.name)
	]
);

export * from './auth.schema';
