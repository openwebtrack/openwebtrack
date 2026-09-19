import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';
import { env } from '$env/dynamic/private';
import { insights } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import db from '$lib/server/db';

const TYPESAFE_API_KEY = env.TYPESAFE_API_KEY;
export const insightsEnabled = !!TYPESAFE_API_KEY;
const client = insightsEnabled ? new TypeSafeClient({ apiKey: TYPESAFE_API_KEY }) : null;

export interface InsightData {
	trend: string;
	trendConfidence: number;
	topDriver: string;
	topDriverConfidence: number;
	quality: string;
	qualityConfidence: number;
	anomalyScore: number;
	revenueTrend: string;
	revenueTrendConfidence: number;
	opportunity: string;
	opportunityConfidence: number;
}

interface TimeSeriesPoint {
	date: string;
	visitors: number;
	pageviews: number;
	revenue?: number;
	customers?: number;
}

interface StatsInput {
	visitors: number;
	pageviews: number;
	sessions: number;
	avgSessionDuration: number;
	online: number;
	revenue: number;
	revenuePerVisitor?: number;
	conversionRate?: number;
	customers: number;
}

interface TopItem {
	label: string;
	value: number;
}

interface InsightsInput {
	stats: StatsInput;
	timeSeries: TimeSeriesPoint[];
	topReferrers: TopItem[];
	topChannels: TopItem[];
	topCountries: TopItem[];
	topPages: TopItem[];
	revenueByChannel: TopItem[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;

const normalizeDate = (date: string) => date.split('T')[0];

const getCached = async (websiteId: string, startDate: string, endDate: string): Promise<InsightData | null> => {
	const dayStart = normalizeDate(startDate);
	const dayEnd = normalizeDate(endDate);
	const now = new Date();

	const cached = await db
		.select()
		.from(insights)
		.where(
			and(
				eq(insights.websiteId, websiteId),
				eq(insights.startDate, dayStart),
				eq(insights.endDate, dayEnd),
				gt(insights.expiresAt, now)
			)
		)
		.limit(1);

	if (cached.length > 0) {
		return cached[0].data as InsightData;
	}
	return null;
};

const setCache = async (websiteId: string, startDate: string, endDate: string, data: InsightData): Promise<void> => {
	const dayStart = normalizeDate(startDate);
	const dayEnd = normalizeDate(endDate);
	const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

	await db
		.delete(insights)
		.where(
			and(
				eq(insights.websiteId, websiteId),
				eq(insights.startDate, dayStart),
				eq(insights.endDate, dayEnd)
			)
		);

	await db.insert(insights).values({
		websiteId,
		startDate: dayStart,
		endDate: dayEnd,
		data,
		expiresAt
	});
};

const buildState = (input: InsightsInput) => {
	const ts = input.timeSeries;
	const prevVisitors = ts.length >= 2 ? ts.slice(0, Math.floor(ts.length / 2)) : [];
	const recentVisitors = ts.length >= 2 ? ts.slice(Math.floor(ts.length / 2)) : [];
	const prevRevenue = prevVisitors.reduce((sum, p) => sum + (p.revenue || 0), 0);
	const recentRevenue = recentVisitors.reduce((sum, p) => sum + (p.revenue || 0), 0);
	const prevAvgVisitors = prevVisitors.length > 0 ? prevVisitors.reduce((sum, p) => sum + p.visitors, 0) / prevVisitors.length : 0;
	const recentAvgVisitors = recentVisitors.length > 0 ? recentVisitors.reduce((sum, p) => sum + p.visitors, 0) / recentVisitors.length : 0;
	const prevAvgRevenue = prevVisitors.length > 0 ? prevRevenue / prevVisitors.length : 0;
	const recentAvgRevenue = recentVisitors.length > 0 ? recentRevenue / recentVisitors.length : 0;

	return {
		summary: {
			totalVisitors: input.stats.visitors,
			totalPageviews: input.stats.pageviews,
			totalRevenue: input.stats.revenue,
			avgSessionDuration: input.stats.avgSessionDuration,
			conversionRate: input.stats.conversionRate || 0,
			customers: input.stats.customers,
			online: input.stats.online
		},
		trend: {
			previousAvgVisitors: Math.round(prevAvgVisitors),
			recentAvgVisitors: Math.round(recentAvgVisitors),
			previousAvgRevenue: Math.round(prevAvgRevenue),
			recentAvgRevenue: Math.round(recentAvgRevenue),
			dataPoints: ts.length
		},
		topReferrers: input.topReferrers.slice(0, 5).map((r) => ({
			domain: r.label,
			sessions: r.value
		})),
		topChannels: input.topChannels.slice(0, 5).map((c) => ({
			name: c.label,
			sessions: c.value
		})),
		topCountries: input.topCountries.slice(0, 5).map((c) => ({
			name: c.label,
			visitors: c.value
		})),
		topPages: input.topPages.slice(0, 5).map((p) => ({
			path: p.label,
			pageviews: p.value
		})),
		revenueByChannel: input.revenueByChannel.slice(0, 5).map((r) => ({
			channel: r.label,
			revenue: r.value
		}))
	};
};

export const generateInsights = async (websiteId: string, input: InsightsInput, startDate: string, endDate: string): Promise<InsightData | null> => {
	if (!client) return null;

	const cached = await getCached(websiteId, startDate, endDate);
	if (cached) return cached;

	const state = buildState(input);

	const response = await client.systemOne({
		state,
		questions: {
			trend: choice(
				'What is the dominant traffic trend in this period based on visitor and pageview patterns?',
				{
					growing: 'Visitor or pageview counts are increasing over time',
					stable: 'Visitor and pageview counts remain consistent',
					declining: 'Visitor or pageview counts are decreasing over time',
					volatile: 'Visitor counts fluctuate significantly with no clear direction',
					insufficient_data: 'Not enough data points to determine a trend'
				}
			),
			top_driver: choice(
				'What is the primary driver of traffic to this website based on referrers and channels?',
				{
					organic_search: 'Most traffic comes from search engines (Google, Bing, etc.)',
					social_referral: 'Most traffic comes from social media platforms',
					paid_campaign: 'Most traffic comes from paid advertising or UTM campaigns',
					direct_traffic: 'Most traffic is direct with no referrer',
					email: 'Most traffic comes from email campaigns',
					referral_other: 'Most traffic comes from other referral sources',
					unknown: 'Unable to determine the primary traffic driver'
				}
			),
			quality: score(
				'Rate the overall visitor engagement quality based on session duration, pages per visit, and conversion rate',
				[
					'Low engagement - visitors leave quickly with minimal interaction',
					'Moderate engagement - some visitors engage but many bounce',
					'High quality - visitors stay, browse multiple pages, and show intent',
					'Exceptional - strong engagement with high conversion and repeat visits'
				]
			),
			anomaly: noul(
				'Is there any anomalous or suspicious pattern in this data such as unusual geographic distribution, bot-like referrer patterns, or extreme traffic spikes?'
			),
			revenue_trend: choice(
				'How is revenue trending relative to traffic volume?',
				{
					outpacing_traffic: 'Revenue is growing faster than traffic, indicating better monetization',
					tracking_proportional: 'Revenue and traffic are growing proportionally',
					lagging_traffic: 'Traffic is growing but revenue is flat or declining',
					declining: 'Both traffic and revenue are declining',
					no_revenue_data: 'No revenue data available for this period'
				}
			),
			opportunity: choice(
				'What is the biggest growth opportunity visible in this data?',
				{
					high_traffic_low_conversion: 'High traffic but low conversion rate suggests optimizing the conversion funnel',
					strong_channel_to_double_down: 'One channel drives disproportionate results and deserves more investment',
					underperforming_referrer: 'A major referrer sends traffic that does not convert and needs investigation',
					geographic_expansion: 'Strong performance in one region suggests expansion potential',
					underutilized_content: 'A few pages drive most traffic, suggesting content expansion opportunities'
				}
			)
		}
	});

	const answers = response.answers;

	const result: InsightData = {
		trend: String(answers.trend.choice),
		trendConfidence: Number(answers.trend.confidence),
		topDriver: String(answers.top_driver.choice),
		topDriverConfidence: Number(answers.top_driver.confidence),
		quality: String(answers.quality.score),
		qualityConfidence: Number(answers.quality.confidence),
		anomalyScore: Number(answers.anomaly.noul),
		revenueTrend: String(answers.revenue_trend.choice),
		revenueTrendConfidence: Number(answers.revenue_trend.confidence),
		opportunity: String(answers.opportunity.choice),
		opportunityConfidence: Number(answers.opportunity.confidence)
	};

	await setCache(websiteId, startDate, endDate, result);

	return result;
};
