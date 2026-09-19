<script lang="ts">
	import { TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles, Target, DollarSign, Zap } from 'lucide-svelte';
	import Skeleton from '$lib/components/dashboard/Skeleton.svelte';

	interface InsightData {
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

	let { insights = null, isLoading = false }: { insights: InsightData | null; isLoading?: boolean } = $props();

	const trendLabels: Record<string, string> = {
		growing: 'Growing',
		stable: 'Stable',
		declining: 'Declining',
		volatile: 'Volatile',
		insufficient_data: 'Needs data'
	};

	const trendIcons: Record<string, string> = {
		growing: 'trending_up',
		stable: 'stable',
		declining: 'trending_down',
		volatile: 'volatile',
		insufficient_data: 'unknown'
	};

	const driverLabels: Record<string, string> = {
		organic_search: 'Organic Search',
		social_referral: 'Social',
		paid_campaign: 'Paid Ads',
		direct_traffic: 'Direct',
		email: 'Email',
		referral_other: 'Referral',
		unknown: 'Unknown'
	};

	const qualityLabels: Record<string, string> = {
		'0': 'Low',
		'1': 'Moderate',
		'2': 'High',
		'3': 'Exceptional'
	};

	const revenueTrendLabels: Record<string, string> = {
		outpacing_traffic: 'Outpacing traffic',
		tracking_proportional: 'Tracking proportionally',
		lagging_traffic: 'Lagging behind',
		declining: 'Declining',
		no_revenue_data: 'No revenue data'
	};

	const opportunityLabels: Record<string, string> = {
		high_traffic_low_conversion: 'Optimize conversion funnel',
		strong_channel_to_double_down: 'Double down on top channel',
		underperforming_referrer: 'Investigate referrer quality',
		geographic_expansion: 'Expand to new regions',
		underutilized_content: 'Expand content strategy'
	};

	const confidenceColor = (confidence: number) => {
		if (confidence >= 0.8) return 'bg-green-500';
		if (confidence >= 0.6) return 'bg-yellow-500';
		return 'bg-orange-500';
	};

	const trendColor = (trend: string) => {
		if (trend === 'growing') return 'text-green-500';
		if (trend === 'declining') return 'text-red-500';
		if (trend === 'volatile') return 'text-yellow-500';
		return 'text-muted-foreground';
	};
</script>

{#if isLoading}
	<div class="glass-card rounded-2xl p-6">
		<div class="mb-4 flex items-center gap-2">
			<Skeleton class="h-4 w-4 rounded-full" />
			<Skeleton class="h-4 w-24" />
		</div>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
			{#each Array(6) as _}
				<div class="rounded-xl border border-border bg-card p-3">
					<Skeleton class="mb-2 h-2.5 w-12" />
					<Skeleton class="mb-1.5 h-4 w-16" />
					<Skeleton class="h-1 w-full rounded-full" />
				</div>
			{/each}
		</div>
	</div>
{:else if insights}
	<div class="glass-card rounded-2xl p-6">
		<div class="mb-4 flex items-center gap-2">
			<Sparkles class="h-4 w-4 text-primary" />
			<span class="text-sm font-medium text-foreground">AI Insights</span>
		</div>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Trend</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					{#if insights.trend === 'growing'}
						<TrendingUp class="h-3.5 w-3.5 {trendColor(insights.trend)}" />
					{:else if insights.trend === 'declining'}
						<TrendingDown class="h-3.5 w-3.5 {trendColor(insights.trend)}" />
					{:else if insights.trend === 'stable'}
						<Minus class="h-3.5 w-3.5 {trendColor(insights.trend)}" />
					{:else}
						<Zap class="h-3.5 w-3.5 {trendColor(insights.trend)}" />
					{/if}
					<span class="text-sm font-medium {trendColor(insights.trend)}">{trendLabels[insights.trend] || insights.trend}</span>
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full {confidenceColor(insights.trendConfidence)}" style="width: {insights.trendConfidence * 100}%"></div>
				</div>
			</div>

			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Traffic Source</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					<Target class="h-3.5 w-3.5 text-blue-500" />
					<span class="text-sm font-medium text-foreground">{driverLabels[insights.topDriver] || insights.topDriver}</span>
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full bg-blue-500" style="width: {insights.topDriverConfidence * 100}%"></div>
				</div>
			</div>

			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Quality</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					<Sparkles class="h-3.5 w-3.5 text-purple-500" />
					<span class="text-sm font-medium text-foreground">{qualityLabels[insights.quality] || insights.quality}</span>
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full bg-purple-500" style="width: {insights.qualityConfidence * 100}%"></div>
				</div>
			</div>

			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Revenue</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					<DollarSign class="h-3.5 w-3.5 text-emerald-500" />
					<span class="text-sm font-medium text-foreground truncate">{revenueTrendLabels[insights.revenueTrend] || insights.revenueTrend}</span>
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full bg-emerald-500" style="width: {insights.revenueTrendConfidence * 100}%"></div>
				</div>
			</div>

			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Opportunity</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					<Target class="h-3.5 w-3.5 text-amber-500" />
					<span class="text-sm font-medium text-foreground truncate">{opportunityLabels[insights.opportunity] || insights.opportunity}</span>
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full bg-amber-500" style="width: {insights.opportunityConfidence * 100}%"></div>
				</div>
			</div>

			<div class="rounded-xl border border-border bg-card p-3">
				<div class="mb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Anomaly</div>
				<div class="mb-1.5 flex items-center gap-1.5">
					{#if insights.anomalyScore > 0.6}
						<AlertTriangle class="h-3.5 w-3.5 text-red-500" />
						<span class="text-sm font-medium text-red-500">Detected</span>
					{:else}
						<Minus class="h-3.5 w-3.5 text-green-500" />
						<span class="text-sm font-medium text-green-500">None</span>
					{/if}
				</div>
				<div class="h-1 w-full overflow-hidden rounded-full bg-secondary">
					<div class="h-full rounded-full {insights.anomalyScore > 0.6 ? 'bg-red-500' : 'bg-green-500'}" style="width: {insights.anomalyScore * 100}%"></div>
				</div>
			</div>
		</div>
	</div>
{/if}
