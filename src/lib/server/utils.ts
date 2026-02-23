import { SEARCH_ENGINES, SOCIAL_NETWORKS, MAX_STRING_LENGTHS, MAX_DATE_RANGE_DAYS } from '$lib/constants';
import type { Filter, DateRange, Granularity } from './types';
import { ilike, and, or, eq } from 'drizzle-orm';
import { pageview, analyticsSession, analyticsEvent, website, teamMember } from './db/schema';
import db from './db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (value: string | undefined | null): value is string => {
	return typeof value === 'string' && UUID_REGEX.test(value);
};

export const validateUUIDParam = (param: string | undefined, name: string = 'id'): string => {
	if (!isValidUUID(param)) {
		throw new Error(`Invalid ${name}`);
	}
	return param;
};

export interface WebsiteAccess {
	site: typeof website.$inferSelect;
	isOwner: boolean;
	isTeamMember: boolean;
}

export const checkWebsiteAccess = async (userId: string, websiteId: string): Promise<WebsiteAccess | null> => {
	const [site] = await db.select().from(website).where(eq(website.id, websiteId)).limit(1);

	if (!site) {
		return null;
	}

	if (site.userId === userId) {
		return { site, isOwner: true, isTeamMember: false };
	}

	const [membership] = await db
		.select()
		.from(teamMember)
		.where(and(eq(teamMember.websiteId, websiteId), eq(teamMember.userId, userId)))
		.limit(1);

	if (membership) {
		return { site, isOwner: false, isTeamMember: true };
	}

	return null;
};

const getTimezoneOffset = (timezone: string, date: Date): number => {
	try {
		const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
		const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
		return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
	} catch {
		return 0;
	}
};

export const convertToTimezone = (date: Date, timezone: string): Date => {
	const offsetMs = getTimezoneOffset(timezone, date) * 60 * 1000;
	return new Date(date.getTime() + offsetMs);
};

export const getDateInTimezone = (date: Date, timezone: string): { year: number; month: number; day: number; hour: number } => {
	const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
	return {
		year: tzDate.getFullYear(),
		month: tzDate.getMonth(),
		day: tzDate.getDate(),
		hour: tzDate.getHours()
	};
};

export const parseDateRange = (startDate: string | null, endDate: string | null, timezone: string = 'UTC'): DateRange => {
	const now = new Date();
	const { year, month, day } = getDateInTimezone(now, timezone);
	const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
	const offsetMs = getTimezoneOffset(timezone, now) * 60 * 1000;
	const todayStartUTC = new Date(todayStart.getTime() - offsetMs);

	const parseDate = (dateStr: string): Date => {
		if (dateStr.includes('T')) return new Date(dateStr);
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
	};

	const clampToMaxRange = (start: Date, end: Date): { start: Date; end: Date } => {
		const maxRangeMs = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;
		const actualRange = end.getTime() - start.getTime();
		if (actualRange > maxRangeMs) {
			start = new Date(end.getTime() - maxRangeMs);
		}
		if (end.getTime() > now.getTime()) {
			end = now;
		}
		return { start, end };
	};

	if (startDate && endDate) {
		let start = parseDate(startDate);
		const startOffsetMs = getTimezoneOffset(timezone, start) * 60 * 1000;
		start.setTime(start.getTime() - startOffsetMs);
		let end = parseDate(endDate);
		const endOffsetMs = getTimezoneOffset(timezone, end) * 60 * 1000;
		end.setTime(end.getTime() - endOffsetMs + 86399999);
		return clampToMaxRange(start, end);
	}

	if (startDate) {
		const start = parseDate(startDate);
		const startOffsetMs = getTimezoneOffset(timezone, start) * 60 * 1000;
		start.setTime(start.getTime() - startOffsetMs);
		const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999);
		return clampToMaxRange(start, end);
	}

	if (endDate) {
		const end = parseDate(endDate);
		const endOffsetMs = getTimezoneOffset(timezone, end) * 60 * 1000;
		end.setTime(end.getTime() - endOffsetMs + 86399999);
		const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
		return clampToMaxRange(start, end);
	}

	const end = new Date(todayStartUTC.getTime() + 86399999);
	const start = new Date(todayStartUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
	return { start, end };
};

export const parseGranularity = (granularity: string | null): Granularity => {
	const validGranularities: Granularity[] = ['hourly', 'daily', 'weekly', 'monthly'];
	const normalized = (granularity || 'daily').toLowerCase() as Granularity;
	return validGranularities.includes(normalized) ? normalized : 'daily';
};

export const parseFilters = (filtersParam: string | null): Filter[] => {
	if (!filtersParam) return [];
	try {
		const parsed = JSON.parse(filtersParam);
		if (Array.isArray(parsed)) {
			return parsed
				.filter((f) => f.type && f.value && typeof f.type === 'string' && typeof f.value === 'string')
				.map((f) => ({
					type: f.type as Filter['type'],
					value: escapeLikePattern(String(f.value).substring(0, MAX_STRING_LENGTHS.filterValue))
				}));
		}
	} catch (e) {
		console.error('Failed to parse filters:', e);
	}
	return [];
};

export const escapeLikePattern = (value: string): string => {
	return value.replace(/[%_\\]/g, '\\$&');
};

export const sanitizeString = (value: unknown, maxLength: number = 2048): string => {
	if (value == null) return '';
	const str = String(value).substring(0, maxLength);
	return str.replace(/[\x00-\x1F\x7F]/g, '');
};

export const isInternalReferrer = (referrer: string | null): boolean => {
	if (!referrer) return false;
	try {
		const hostname = new URL(referrer).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local') || hostname.endsWith('.localhost');
	} catch {
		return false;
	}
};

const SOCIAL_SOURCE_ALIASES: Record<string, string> = {
	ig: 'instagram',
	fb: 'facebook',
	tw: 'twitter',
	x: 'x.com',
	tt: 'tiktok',
	li: 'linkedin',
	pi: 'pinterest',
	rd: 'reddit',
	yt: 'youtube',
	sc: 'snapchat',
	wa: 'whatsapp',
	tg: 'telegram',
	dc: 'discord',
	gh: 'github'
};

export const categorizeChannel = (referrer: string | null, utmSource: string | null, utmMedium: string | null): string => {
	const source = (utmSource || '').toLowerCase();
	const medium = (utmMedium || '').toLowerCase();

	const resolveSocialSource = (src: string): string | null => {
		const resolved = SOCIAL_SOURCE_ALIASES[src];
		if (resolved) return resolved;
		const social = SOCIAL_NETWORKS.find((s) => src.includes(s) || s.includes(src));
		if (social) return social;
		return null;
	};

	if (utmSource || utmMedium) {
		if (medium === 'email' || source.includes('email') || source.includes('mail')) return 'Email';
		if (medium === 'paid' || medium === 'cpc' || medium === 'ppc' || source.includes('ads')) return 'Paid';

		if (medium === 'social') {
			const socialSource = resolveSocialSource(source);
			return socialSource ? socialSource.charAt(0).toUpperCase() + socialSource.slice(1) : 'Social';
		}

		const socialSource = resolveSocialSource(source);
		if (socialSource) return socialSource.charAt(0).toUpperCase() + socialSource.slice(1);

		const searchSource = SEARCH_ENGINES.find((s) => source.includes(s) || s.includes(source));
		if (medium === 'organic' || searchSource) {
			return searchSource ? searchSource.charAt(0).toUpperCase() + searchSource.slice(1) : 'Organic Search';
		}
		if (medium === 'referral' || medium === 'affiliate') return 'Referral';
	}

	if (!referrer || isInternalReferrer(referrer)) return 'Direct';

	try {
		const hostname = new URL(referrer).hostname.replace('www.', '').toLowerCase();

		const socialHost = SOCIAL_NETWORKS.find((s) => hostname.includes(s));
		if (socialHost) return socialHost.charAt(0).toUpperCase() + socialHost.slice(1);

		const searchHost = SEARCH_ENGINES.find((e) => hostname.includes(e));
		if (searchHost) return searchHost.charAt(0).toUpperCase() + searchHost.slice(1);

		return 'Referral';
	} catch {
		return 'Direct';
	}
};

export const buildFilterConditions = (filters: Filter[]) => {
	const sessionConditions: ReturnType<typeof and>[] = [];
	const pageviewConditions: ReturnType<typeof and>[] = [];
	const eventConditions: ReturnType<typeof and>[] = [];

	for (const filter of filters) {
		switch (filter.type) {
			case 'referrer':
				pageviewConditions.push(and(ilike(pageview.referrer, `%${filter.value}%`)));
				sessionConditions.push(and(ilike(analyticsSession.referrer, `%${filter.value}%`)));
				break;
			case 'campaign':
				sessionConditions.push(or(ilike(analyticsSession.utmSource, `%${filter.value}%`), ilike(analyticsSession.utmCampaign, `%${filter.value}%`)));
				break;
			case 'country':
				sessionConditions.push(and(ilike(analyticsSession.country, `%${filter.value}%`)));
				break;
			case 'region':
				sessionConditions.push(and(ilike(analyticsSession.region, `%${filter.value}%`)));
				break;
			case 'city':
				sessionConditions.push(and(ilike(analyticsSession.city, `%${filter.value}%`)));
				break;
			case 'goal':
				eventConditions.push(and(ilike(analyticsEvent.name, `%${filter.value}%`)));
				break;
			case 'hostname':
			case 'page':
			case 'entryPage':
				pageviewConditions.push(and(ilike(pageview.pathname, `%${filter.value}%`)));
				break;
			case 'browser':
				sessionConditions.push(and(ilike(analyticsSession.browser, `%${filter.value}%`)));
				break;
			case 'os':
				sessionConditions.push(and(ilike(analyticsSession.os, `%${filter.value}%`)));
				break;
			case 'device':
				sessionConditions.push(and(ilike(analyticsSession.deviceType, `%${filter.value}%`)));
				break;
		}
	}

	return { sessionConditions, pageviewConditions, eventConditions };
};

export const extractPathname = (url: string): string => {
	try {
		return new URL(url).pathname;
	} catch {
		return url.split('?')[0]?.substring(0, 255) || '/';
	}
};

export const extractUtmParams = (url: string, referrer: string | null): { source?: string; medium?: string; campaign?: string } => {
	try {
		const parsed = new URL(url);
		let source = parsed.searchParams.get('utm_source') || undefined;
		let medium = parsed.searchParams.get('utm_medium') || undefined;
		let campaign = parsed.searchParams.get('utm_campaign') || undefined;

		if (!source && referrer) {
			try {
				const referrerUrl = new URL(referrer);
				source = referrerUrl.searchParams.get('utm_source') || undefined;
				medium = medium || referrerUrl.searchParams.get('utm_medium') || undefined;
				campaign = campaign || referrerUrl.searchParams.get('utm_campaign') || undefined;
			} catch {}
		}

		return { source, medium, campaign };
	} catch {
		if (referrer) {
			try {
				const referrerUrl = new URL(referrer);
				return {
					source: referrerUrl.searchParams.get('utm_source') || undefined,
					medium: referrerUrl.searchParams.get('utm_medium') || undefined,
					campaign: referrerUrl.searchParams.get('utm_campaign') || undefined
				};
			} catch {}
		}
		return {};
	}
};

export const getWeekKey = (date: Date, timezone: string = 'UTC'): string => {
	const { year, month, day } = getDateInTimezone(date, timezone);
	const d = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
	const dayOfWeek = d.getUTCDay();
	const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
	d.setUTCDate(diff);
	return d.toISOString().split('T')[0];
};

export const getMonthKey = (date: Date, timezone: string = 'UTC'): string => {
	const { year, month } = getDateInTimezone(date, timezone);
	return `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

export const getHourKey = (date: Date, timezone: string = 'UTC'): string => {
	const { year, month, day, hour } = getDateInTimezone(date, timezone);
	const d = new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
	return d.toISOString().slice(0, 13) + ':00';
};

export const getDayKey = (date: Date, timezone: string = 'UTC'): string => {
	const { year, month, day } = getDateInTimezone(date, timezone);
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
