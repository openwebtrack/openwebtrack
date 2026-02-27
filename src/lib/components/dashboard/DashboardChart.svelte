<script lang="ts">
	import cn from '@/utils/helpers';
	import { Tooltip } from 'chart.js';
	import Chart from 'chart.js/auto';

	// Register custom positioner to make tooltip follow mouse cursor
	// @ts-ignore - Tooltip.positioners type doesn't include custom positioners
	Tooltip.positioners.followMouse = function (elements: any, eventPosition: { x: number; y: number }) {
		return {
			x: eventPosition.x,
			y: eventPosition.y
		};
	};

	interface TimeSeriesPoint {
		date: string;
		visitors: number;
		revenue?: number;
	}

	interface Stats {
		visitors: number;
		sessions: number;
		avgSessionDuration: number;
		online: number;
		revenue?: number;
		customers?: number;
	}

	let {
		timeSeries = [],
		stats = { visitors: 0, sessions: 0, avgSessionDuration: 0, online: 0, revenue: 0, customers: 0 },
		granularity = 'daily'
	}: {
		timeSeries?: TimeSeriesPoint[];
		stats?: Stats;
		granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let tooltipEl: HTMLDivElement | undefined = $state();
	let chart: Chart | null = null;

	let showVisitors = $state(true);
	let showRevenue = $state(true);
	let activeCard: string | null = $state(null);

	const toggleCard = (card: string) => {
		activeCard = activeCard === card ? null : card;
	};

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

		const labels = timeSeries.map((p) => formatLabel(p.date));
		const visitorsData = timeSeries.map((p) => p.visitors);
		const revenueData = timeSeries.map((p) => p.revenue || 0);

		const hasRevenue = revenueData.some((r) => r > 0) && showRevenue;

		const maxValue = Math.max(...(showVisitors ? visitorsData : []), 5);
		const yMax = Math.ceil(maxValue * 1.2);

		const maxTicksLimit = granularity === 'hourly' ? 24 : granularity === 'monthly' ? 12 : 8;

		const externalTooltipHandler = (context: any) => {
			const { chart, tooltip } = context;
			if (!tooltipEl) return;

			const el = tooltipEl;

			if (tooltip.opacity === 0) {
				el.style.opacity = '0';
				return;
			}

			if (tooltip.body) {
				const titleLines = tooltip.title || [];
				const bodyLines = tooltip.body.map((b: any) => b.lines);

				el.textContent = '';

				titleLines.forEach((title: string) => {
					const titleDiv = document.createElement('div');
					titleDiv.className = 'mb-2 font-medium';
					titleDiv.textContent = title;
					el.appendChild(titleDiv);
				});

				const bodyContainer = document.createElement('div');
				bodyContainer.className = 'flex flex-col gap-1';

				bodyLines.forEach((body: string, i: number) => {
					const colors = tooltip.labelColors[i];
					const parts = body[0].split(': ');
					const label = parts[0];
					const value = parts[1];

					const row = document.createElement('div');
					row.className = 'flex items-center justify-between gap-4 text-xs text-muted-foreground';

					const leftSide = document.createElement('div');
					leftSide.className = 'flex items-center gap-2';

					const dot = document.createElement('div');
					dot.className = 'h-2 w-2 rounded-full';
					dot.style.backgroundColor = colors.borderColor;
					dot.style.boxShadow = `0 0 8px color-mix(in srgb, ${colors.borderColor}, transparent 20%)`;

					const labelSpan = document.createElement('span');
					labelSpan.textContent = label;

					leftSide.appendChild(dot);
					leftSide.appendChild(labelSpan);

					const valueSpan = document.createElement('span');
					valueSpan.className = 'font-medium text-foreground';
					valueSpan.textContent = value;

					row.appendChild(leftSide);
					row.appendChild(valueSpan);
					bodyContainer.appendChild(row);
				});

				el.appendChild(bodyContainer);
			}

			const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

			el.style.opacity = '1';
			el.style.left = positionX + tooltip.caretX + 'px';
			el.style.top = positionY + tooltip.caretY + 'px';
		};

		return new Chart(ctx, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Visitors',
						data: showVisitors ? visitorsData : [],
						borderColor: primary,
						backgroundColor: gradientVisitors,
						borderWidth: 2,
						tension: 0.4,
						pointRadius: 0,
						pointHoverRadius: 6,
						hoverBackgroundColor: primary,
						hoverBorderColor: '#fff',
						hoverBorderWidth: 2,
						fill: true,
						yAxisID: 'y'
					},
					...(hasRevenue
						? [
								{
									label: 'Revenue',
									type: 'bar' as const,
									data: revenueData,
									backgroundColor: '#3b82f6',
									borderRadius: 2,
									borderColor: '#3b82f6',
									hoverBackgroundColor: '#3b82f6',
									hoverBorderColor: '#fff',
									barPercentage: 1,
									categoryPercentage: 1,
									order: 1,
									barThickness: 50,
									maxBarThickness: 50,
									yAxisID: 'y1'
								}
							]
						: [])
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
					legend: { display: false },
					tooltip: {
						enabled: false,
						position: 'followMouse' as 'nearest',
						external: externalTooltipHandler,
						callbacks: {
							label: function (context: any) {
								const label = context.dataset.label || '';
								const value = context.parsed.y;
								if (label.toLowerCase().includes('revenue')) {
									return `${label}: $${(value / 100).toFixed(2)}`;
								}
								return `${label}: ${value}`;
							}
						}
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
					},
					...(hasRevenue
						? {
								y1: {
									position: 'right' as const,
									beginAtZero: true,
									grid: {
										display: false
									},
									ticks: {
										color: '#3b82f6',
										callback: ((value: string | number) => `$${(Number(value) / 100).toFixed(0)}`) as any
									},
									border: {
										display: false
									}
								}
							}
						: {})
				}
			}
		});
	};

	const updateChart = () => {
		if (!chart || !timeSeries) return;

		const labels = timeSeries.map((p) => formatLabel(p.date));
		const visitorsData = timeSeries.map((p) => p.visitors);
		const revenueData = timeSeries.map((p) => p.revenue || 0);

		const hasRevenue = revenueData.some((r) => r > 0) && showRevenue;

		const maxValue = Math.max(...(showVisitors ? visitorsData : []), 5);
		const yMax = Math.ceil(maxValue * 1.2);

		const maxTicksLimit = granularity === 'hourly' ? 24 : granularity === 'monthly' ? 12 : 8;

		chart.data.labels = labels;
		if (chart.data.datasets[0]) {
			chart.data.datasets[0].data = showVisitors ? visitorsData : [];
		}
		if (chart.data.datasets[1]) {
			chart.data.datasets[1].data = hasRevenue ? revenueData : [];
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
	<div class="mb-8 grid grid-cols-2 gap-6 md:grid-cols-7">
		<button class="relative cursor-pointer overflow-hidden rounded-xl bg-muted/50 p-4 transition-all hover:bg-muted" onclick={() => (showRevenue = !showRevenue)}>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Revenue</span>
				<div class={cn('size-4 rounded-full border border-blue-500', showRevenue && 'bg-blue-500')}></div>
			</div>
			<div class="text-left text-2xl font-bold tracking-tight">${((stats.revenue || 0) / 100).toFixed(2)}</div>
		</button>

		<button class="relative cursor-pointer overflow-hidden rounded-xl bg-muted/50 p-4 transition-all hover:bg-muted" onclick={() => (showVisitors = !showVisitors)}>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground">Visitors</span>
				<div class={cn('size-4 rounded-full border border-primary', showVisitors && 'bg-primary')}></div>
			</div>
			<div class="text-left text-2xl font-bold tracking-tight">{stats.visitors}</div>
		</button>

		<div class="p-4">
			<div class="mb-2 flex items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Online</span>
				<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
			</div>
			<div class="text-2xl font-bold tracking-tight">{stats.online}</div>
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
	</div>

	<div class="relative h-[300px] w-full">
		<canvas bind:this={canvas}></canvas>
		<div
			bind:this={tooltipEl}
			class="pointer-events-none absolute z-50 min-w-[140px] rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl transition-opacity duration-200"
			style="opacity: 0; transform: translate(-50%, -100%) translateY(-8px);"
		></div>
		{#if !timeSeries || timeSeries.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
				<p>No data for selected period</p>
			</div>
		{/if}
	</div>
</div>
