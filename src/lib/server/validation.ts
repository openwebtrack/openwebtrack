import { z } from 'zod';
import { MAX_STRING_LENGTHS } from '@/utils/constants';

const uuidSchema = z.string().uuid();

const domainSchema = z
	.string()
	.min(1, 'Domain is required')
	.max(255, 'Domain too long')
	.transform((val) =>
		val
			.toLowerCase()
			.trim()
			.replace(/^https?:\/\//, '')
			.replace(/^www\./, '')
			.replace(/\/.*$/, '')
	);

const timezoneSchema = z.string().max(100).default('UTC');

const stringArraySchema = z.array(z.string().max(500)).max(100).default([]);

const trafficSpikeSchema = z
	.object({
		enabled: z.boolean().default(false),
		threshold: z.number().int().min(10).max(10000).default(100),
		windowSeconds: z.number().int().min(10).max(3600).default(60)
	})
	.default({ enabled: false, threshold: 100, windowSeconds: 60 });

const weeklySummarySchema = z
	.object({
		enabled: z.boolean().default(false)
	})
	.default({ enabled: false });

const notificationsSchema = z
	.object({
		trafficSpike: trafficSpikeSchema,
		weeklySummary: weeklySummarySchema
	})
	.default({
		trafficSpike: { enabled: false, threshold: 100, windowSeconds: 60 },
		weeklySummary: { enabled: false }
	});

export const websiteCreateSchema = z.object({
	domain: domainSchema,
	timezone: timezoneSchema.optional()
});

export const websiteUpdateSchema = z.object({
	domain: domainSchema.optional(),
	timezone: timezoneSchema.optional(),
	excludedIps: stringArraySchema.optional(),
	excludedPaths: stringArraySchema.optional(),
	excludedCountries: stringArraySchema.optional(),
	notifications: notificationsSchema.optional()
});

export const teamInviteSchema = z.object({
	email: z.string().email('Invalid email address').toLowerCase().trim()
});

const eventTypeSchema = z.enum(['pageview', 'custom', 'identify', 'heartbeat', 'payment']);

export const trackingPayloadSchema = z.object({
	websiteId: z.string().uuid('Invalid website ID').optional(),
	domain: z.string().min(1, 'Domain is required').max(MAX_STRING_LENGTHS.domain),
	type: eventTypeSchema,
	href: z.string().min(1, 'URL is required').max(MAX_STRING_LENGTHS.href),
	referrer: z.string().max(MAX_STRING_LENGTHS.referrer).nullable().optional(),
	visitorId: z.string().min(1, 'Visitor ID is required').max(MAX_STRING_LENGTHS.visitorId),
	sessionId: z.string().min(1, 'Session ID is required').max(MAX_STRING_LENGTHS.sessionId),
	viewport: z
		.object({
			width: z.number().int().min(0).max(10000),
			height: z.number().int().min(0).max(10000)
		})
		.optional(),
	screenWidth: z.number().int().min(0).max(10000).optional(),
	screenHeight: z.number().int().min(0).max(10000).optional(),
	language: z.string().max(MAX_STRING_LENGTHS.language).optional(),
	timezone: z.string().max(MAX_STRING_LENGTHS.timezone).optional(),
	browser: z.string().max(MAX_STRING_LENGTHS.browser).optional(),
	browserVersion: z.string().max(MAX_STRING_LENGTHS.browserVersion).optional(),
	os: z.string().max(MAX_STRING_LENGTHS.os).optional(),
	osVersion: z.string().max(MAX_STRING_LENGTHS.osVersion).optional(),
	deviceType: z.string().max(MAX_STRING_LENGTHS.deviceType).optional(),
	isPwa: z.boolean().optional(),
	title: z.string().max(MAX_STRING_LENGTHS.title).optional(),
	name: z.string().max(MAX_STRING_LENGTHS.eventName).optional(),
	data: z.record(z.string(), z.unknown()).optional(),
	amount: z.number().int().min(0).optional(),
	currency: z.string().max(MAX_STRING_LENGTHS.currency).optional(),
	transactionId: z.string().max(MAX_STRING_LENGTHS.transactionId).optional()
});

export const metricsQuerySchema = z.object({
	type: z.enum(['pages', 'entry_pages', 'exit_links', 'referrers', 'channels', 'campaigns', 'countries', 'regions', 'cities', 'browsers', 'os', 'devices', 'screens', 'hostnames']).optional(),
	search: z.string().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(1000).default(50),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	filters: z.string().optional()
});

export const statsQuerySchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
	filters: z.string().optional()
});

export const eventsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).max(10000).default(0)
});

export const importSchema = z.object({
	platform: z.enum(['umami', 'plausible', 'datafast']).default('umami'),
	apiKey: z.string().optional()
});

export const isValidUUID = (value: string): boolean => {
	return uuidSchema.safeParse(value).success;
};

export const validateBody = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; errors: string[] } => {
	const result = schema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	const issues = result.error.issues;
	const errors = issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`);
	return { success: false, error: errors[0] || 'Validation failed', errors };
};

export const validateQuery = <T>(schema: z.ZodSchema<T>, params: URLSearchParams): { success: true; data: T } | { success: false; error: string; errors: string[] } => {
	const obj: Record<string, string> = {};
	params.forEach((value, key) => {
		obj[key] = value;
	});
	const result = schema.safeParse(obj);
	if (result.success) {
		return { success: true, data: result.data };
	}
	const issues = result.error.issues;
	const errors = issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`);
	return { success: false, error: errors[0] || 'Validation failed', errors };
};
