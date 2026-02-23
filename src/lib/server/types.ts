export type FilterType = 'referrer' | 'campaign' | 'country' | 'region' | 'city' | 'goal' | 'hostname' | 'page' | 'entryPage' | 'browser' | 'os' | 'device';

export interface Filter {
	type: FilterType;
	value: string;
}

export interface DateRange {
	start: Date;
	end: Date;
}

export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface GeoData {
	country: string | null;
	region: string | null;
	city: string | null;
}

export interface TrackingPayload {
	websiteId: string;
	domain: string;
	type: 'pageview' | 'custom' | 'identify' | 'payment' | 'heartbeat';
	href: string;
	referrer?: string | null;
	visitorId: string;
	sessionId: string;
	viewport?: { width: number; height: number };
	screenWidth?: number;
	screenHeight?: number;
	language?: string;
	timezone?: string;
	browser?: string;
	browserVersion?: string;
	os?: string;
	osVersion?: string;
	deviceType?: string;
	isPwa?: boolean;
	title?: string;
	name?: string;
	data?: Record<string, unknown>;
}
