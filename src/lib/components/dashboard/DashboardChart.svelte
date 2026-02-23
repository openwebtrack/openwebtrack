<script lang="ts">
	import Chart from 'chart.js/auto';

	interface TimeSeriesPoint {
		date: string;
		visitors: number;
		pageviews: number;
	}

	interface Stats {
		visitors: number;
		pageviews: number;
		sessions: number;
		avgSessionDuration: number;
		online: number;
	}

	let {
		timeSeries = [],
		stats = { visitors: 0, pageviews: 0, sessions: 0, avgSessionDuration: 0, online: 0 },
		granularity = 'daily'
	}: {
		timeSeries?: TimeSeriesPoint[];
		stats?: Stats;
		granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	const formatLabel = (dateStr: string): string => {
		if (granularity === 'hourly') {
			const date = new Date(dateStr);
			return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
		} else if (granularity === 'monthly') {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		} else if (granularity === 'weekly') {
			const date = new Date(dateStr);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};

	const formatDuration = (ms: number): string => {
		if (ms <= 0) return '-';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) {
			const mins = minutes % 60;
			return `${hours}m ${mins}s`;
		}
		if (minutes > 0) {
			const secs = seconds % 60;
			return `${minutes}m ${secs}s`;
		}
		return `${seconds}s`;
	};

	const createChart = () => {
		if (!canvas) return null;

		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		// Resolve theme colors
		const computedStyle = getComputedStyle(document.documentElement);
		const primary = computedStyle.getPropertyValue('--primary').trim() || '#3b82f6';
		const chart2 = computedStyle.getPropertyValue('--chart-2').trim() || '#a855f7';
		const card = computedStyle.getPropertyValue('--card').trim() || '#fff';
		const foreground = computedStyle.getPropertyValue('--foreground').trim() || '#000';
		const mutedForeground = computedStyle.getPropertyValue('--muted-foreground').trim() || '#71717a';
		const border = computedStyle.getPropertyValue('--border').trim() || '#e4e4e7';

		if (!timeSeries || timeSeries.length === 0) {
			return null;
		}

		const gradientVisitors = ctx.createLinearGradient(0, 0, 0, 300);
		gradientVisitors.addColorStop(0, `color-mix(in srgb, ${primary}, transparent 75%)`);
		gradientVisitors.addColorStop(1, `color-mix(in srgb, ${primary}, transparent 100%)`);

		const gradientPageviews = ctx.createLinearGradient(0, 0, 0, 300);
		gradientPageviews.addColorStop(0, `color-mix(in srgb, ${chart2}, transparent 75%)`);
		gradientPageviews.addColorStop(1, `color-mix(in srgb, ${chart2}, transparent 100%)`);

		const labels = timeSeries.map((p) => formatLabel(p.date));
		const visitorsData = timeSeries.map((p) => p.visitors);
		const pageviewsData = timeSeries.map((p) => p.pageviews);

		const maxValue = Math.max(...visitorsData, ...pageviewsData, 5);
		const yMax = Math.ceil(maxValue * 1.2);

		const maxTicksLimit = granularity === 'hourly' ? 24 : granularity === 'monthly' ? 12 : 8;

		return new Chart(ctx, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Visitors',
						data: visitorsData,
						borderColor: primary,
						backgroundColor: gradientVisitors,
						borderWidth: 2,
						tension: 0.4,
						pointRadius: 0,
						pointHoverRadius: 6,
						pointHoverBackgroundColor: primary,
						pointHoverBorderColor: '#fff',
						pointHoverBorderWidth: 2,
						fill: true
					},
					{
						label: 'Pageviews',
						data: pageviewsData,
						borderColor: chart2,
						backgroundColor: gradientPageviews,
						borderWidth: 2,
						tension: 0.4,
						pointRadius: 0,
						pointHoverRadius: 6,
						pointHoverBackgroundColor: chart2,
						pointHoverBorderColor: '#fff',
						pointHoverBorderWidth: 2,
						fill: true,
						borderDash: [5, 5]
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: card,
						titleColor: foreground,
						bodyColor: mutedForeground,
						borderColor: border,
						borderWidth: 1,
						padding: 12,
						cornerRadius: 12,
						displayColors: true
					}
				},
				scales: {
					x: {
						grid: {
							display: false
						},
						ticks: {
							color: mutedForeground,
							maxTicksLimit: maxTicksLimit,
							autoSkip: true
						}
					},
					y: {
						beginAtZero: true,
						max: yMax,
						grid: {
							color: `color-mix(in srgb, ${border}, transparent 50%)`
						},
						ticks: {
							color: mutedForeground,
							stepSize: 1
						},
						border: {
							display: false
						}
					}
				}
			}
		});
	};

	const updateChart = () => {
		if (!chart || !timeSeries) return;

		const labels = timeSeries.map((p) => formatLabel(p.date));
		const visitorsData = timeSeries.map((p) => p.visitors);
		const pageviewsData = timeSeries.map((p) => p.pageviews);

		const maxValue = Math.max(...visitorsData, ...pageviewsData, 5);
		const yMax = Math.ceil(maxValue * 1.2);

		const maxTicksLimit = granularity === 'hourly' ? 24 : granularity === 'monthly' ? 12 : 8;

		chart.data.labels = labels;
		if (chart.data.datasets[0]) {
			chart.data.datasets[0].data = visitorsData;
		}
		if (chart.data.datasets[1]) {
			chart.data.datasets[1].data = pageviewsData;
		}

		if (chart.options.scales?.y) {
			chart.options.scales.y.max = yMax;
		}
		if (chart.options.scales?.x?.ticks) {
			chart.options.scales.x.ticks.maxTicksLimit = maxTicksLimit;
		}

		chart.update('none');
	};

	$effect(() => {
		if (!canvas) return;
		if (!timeSeries || timeSeries.length === 0) {
			if (chart) {
				chart.destroy();
				chart = null;
			}
			return;
		}

		if (chart) {
			updateChart();
		} else {
			chart = createChart();
		}
	});
</script>

<div class="rounded-2xl border border-border bg-card p-6">
	<div class="mb-8 grid grid-cols-2 gap-6 md:grid-cols-6">
		<div class="relative overflow-hidden rounded-xl bg-muted/50 p-4 transition-all hover:bg-muted">
			<div class="mb-2 flex items-center gap-2">
				<div class="h-2 w-2 rounded-full" style="background-color: var(--primary); box-shadow: 0 0 8px color-mix(in srgb, var(--primary), transparent 50%)"></div>
				<span class="text-xs font-medium text-muted-foreground">Visitors</span>
			</div>
			<div class="text-2xl font-bold tracking-tight">{stats.visitors}</div>
		</div>

		<div class="relative overflow-hidden rounded-xl bg-muted/50 p-4 transition-all hover:bg-muted">
			<div class="mb-2 flex items-center gap-2">
				<div class="h-2 w-2 rounded-full" style="background-color: var(--chart-2); box-shadow: 0 0 8px color-mix(in srgb, var(--chart-2), transparent 50%)"></div>
				<span class="text-xs font-medium text-muted-foreground">Pageviews</span>
			</div>
			<div class="text-2xl font-bold tracking-tight">{stats.pageviews}</div>
		</div>

		<div class="p-4">
			<div class="mb-2">
				<span class="text-xs font-medium text-muted-foreground">Sessions</span>
			</div>
			<div class="text-2xl font-bold">{stats.sessions}</div>
		</div>

		<div class="p-4">
			<div class="mb-2">
				<span class="text-xs font-medium text-muted-foreground">Session time</span>
			</div>
			<div class="text-2xl font-bold">{formatDuration(stats.avgSessionDuration)}</div>
		</div>

		<div class="p-4">
			<div class="mb-2 flex items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Online</span>
				<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
			</div>
			<div class="text-2xl font-bold">{stats.online}</div>
		</div>
	</div>

	<div class="relative h-[300px] w-full">
		<canvas bind:this={canvas}></canvas>
		{#if !timeSeries || timeSeries.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
				<p>No data for selected period</p>
			</div>
		{/if}
	</div>
</div>
