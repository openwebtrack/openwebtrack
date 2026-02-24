<script lang="ts">
	import { Lightbulb } from 'lucide-svelte';
	import { Tooltip, ArcElement, DoughnutController } from 'chart.js';
	import Chart, { type ChartConfiguration } from 'chart.js/auto';

	// Register custom positioner to make tooltip follow mouse cursor
	// @ts-ignore - Tooltip.positioners type doesn't include custom positioners
	Tooltip.positioners.followMouse = function (elements: any, eventPosition: { x: number; y: number }) {
		return {
			x: eventPosition.x,
			y: eventPosition.y
		};
	};

	interface ChannelItem {
		label: string;
		value: number;
	}

	let { data = [] }: { data?: ChannelItem[] } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let tooltipEl: HTMLDivElement | undefined = $state();
	let chart: Chart | undefined;

	const createChart = () => {
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Resolve colors
		const computedStyle = getComputedStyle(document.documentElement);
		const primary = computedStyle.getPropertyValue('--primary').trim() || '#3b82f6';
		const chart2 = computedStyle.getPropertyValue('--chart-2').trim() || '#a855f7';
		const chart3 = computedStyle.getPropertyValue('--chart-3').trim() || '#22c55e';
		const chart4 = computedStyle.getPropertyValue('--chart-4').trim() || '#eab308';
		const chart5 = computedStyle.getPropertyValue('--chart-5').trim() || '#f97316';
		const card = computedStyle.getPropertyValue('--card').trim() || '#fff';
		const foreground = computedStyle.getPropertyValue('--foreground').trim() || '#000';
		const mutedForeground = computedStyle.getPropertyValue('--muted-foreground').trim() || '#71717a';
		const border = computedStyle.getPropertyValue('--border').trim() || '#e4e4e7';

		const resolvedColors = [primary, chart2, chart3, chart4, chart5, '#ec4899'];

		if (data.length === 0 || data.every((d) => d.value === 0)) {
			if (chart) {
				chart.destroy();
				chart = undefined;
			}
			return;
		}

		const labels = data.map((d) => d.label);
		const values = data.map((d) => d.value);
		const colors = resolvedColors.slice(0, data.length);

		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = values;
			chart.data.datasets[0].backgroundColor = colors;
			chart.update('none');
			return;
		}

		// Custom plugin to draw callout labels with collision detection
		const outerLabelsPlugin = {
			id: 'outerLabels',
			afterDraw: (chart: Chart) => {
				const {
					ctx,
					chartArea: { width, height, top, left }
				} = chart;
				const centerX = left + width / 2;
				const centerY = top + height / 2;

				ctx.save();

				const labelItems: Array<{
					index: number;
					startX: number;
					startY: number;
					elbowX: number;
					elbowY: number;
					endX: number;
					endY: number;
					isRightSide: boolean;
					label: string;
				}> = [];

				chart.data.datasets.forEach((dataset, i) => {
					const meta = chart.getDatasetMeta(i);
					const outerRadius = (meta.data[0] as ArcElement).outerRadius;

					meta.data.forEach((element: any, index: number) => {
						const { startAngle, endAngle } = element;
						const midAngle = startAngle + (endAngle - startAngle) / 2;

						const startX = centerX + Math.cos(midAngle) * outerRadius;
						const startY = centerY + Math.sin(midAngle) * outerRadius;

						const lineLen = 20;
						const elbowX = centerX + Math.cos(midAngle) * (outerRadius + lineLen);
						const elbowY = centerY + Math.sin(midAngle) * (outerRadius + lineLen);

						const labelOffset = 20;
						const isRightSide = Math.cos(midAngle) >= 0;
						const endX = isRightSide ? elbowX + labelOffset : elbowX - labelOffset;
						const endY = elbowY;

						labelItems.push({
							index,
							startX,
							startY,
							elbowX,
							elbowY,
							endX,
							endY,
							isRightSide,
							label: chart.data.labels?.[index] as string
						});
					});
				});

				const minSpacing = 16; // 12px font + 4px padding

				// Function to adjust Y positions to prevent overlap
				const adjustPositions = (items: typeof labelItems) => {
					// Sort by Y position (top to bottom)
					items.sort((a, b) => a.endY - b.endY);

					for (let i = 1; i < items.length; i++) {
						const prev = items[i - 1];
						const curr = items[i];

						if (curr.endY < prev.endY + minSpacing) {
							const diff = prev.endY + minSpacing - curr.endY;
							curr.endY += diff;
							curr.elbowY += diff;
						}
					}
				};

				const leftItems = labelItems.filter((item) => !item.isRightSide);
				const rightItems = labelItems.filter((item) => item.isRightSide);

				adjustPositions(leftItems);
				adjustPositions(rightItems);

				[...leftItems, ...rightItems].forEach((item) => {
					const { startX, startY, elbowX, elbowY, isRightSide, label } = item;

					// Recalculate endX based on the original offset logic but using new elbowY (which is same as endY)
					const labelOffset = 20;
					const finalEndX = isRightSide ? elbowX + labelOffset : elbowX - labelOffset;
					
					ctx.beginPath();
					ctx.moveTo(startX, startY);
					ctx.lineTo(elbowX, elbowY);
					ctx.lineTo(finalEndX, elbowY);
					ctx.strokeStyle = mutedForeground;
					ctx.lineWidth = 1;
					ctx.stroke();

					ctx.font = '12px sans-serif';
					ctx.fillStyle = foreground;
					ctx.textBaseline = 'middle';
					ctx.textAlign = isRightSide ? 'left' : 'right';

					const textX = isRightSide ? finalEndX + 5 : finalEndX - 5;
					ctx.fillText(label, textX, elbowY);
				});

				ctx.restore();
			}
		};

		const externalTooltipHandler = (context: any) => {
			const { chart, tooltip } = context;
			if (!tooltipEl) return;

			const el = tooltipEl;

			if (tooltip.opacity === 0) {
				el.style.opacity = '0';
				return;
			}

			if (tooltip.body) {
				const dataPoints = tooltip.dataPoints;

				el.textContent = '';

				const container = document.createElement('div');
				container.className = 'flex flex-col gap-1';

				dataPoints.forEach((dataPoint: any, i: number) => {
					const colors = tooltip.labelColors[i];
					const label = dataPoint.label;
					const value = dataPoint.formattedValue;

					const row = document.createElement('div');
					row.className = 'flex items-center justify-between gap-4 text-xs text-muted-foreground';

					const leftSide = document.createElement('div');
					leftSide.className = 'flex items-center gap-2';

					const dot = document.createElement('div');
					dot.className = 'h-2 w-2 rounded-full';
					dot.style.backgroundColor = colors.backgroundColor;
					dot.style.boxShadow = `0 0 8px color-mix(in srgb, ${colors.backgroundColor}, transparent 20%)`;

					const labelSpan = document.createElement('span');
					labelSpan.textContent = label;

					leftSide.appendChild(dot);
					leftSide.appendChild(labelSpan);

					const valueSpan = document.createElement('span');
					valueSpan.className = 'font-medium text-foreground';
					valueSpan.textContent = value;

					row.appendChild(leftSide);
					row.appendChild(valueSpan);
					container.appendChild(row);
				});

				el.appendChild(container);
			}

			const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

			el.style.opacity = '1';
			el.style.left = positionX + tooltip.caretX + 'px';
			el.style.top = positionY + tooltip.caretY + 'px';
		};

		const config: ChartConfiguration<'doughnut'> = {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data: values,
						backgroundColor: colors,
						borderWidth: 0,
						hoverOffset: 4,
						borderRadius: 10,
						spacing: 5
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '70%',
				layout: {
					padding: 24
				},
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						enabled: false,
						position: 'followMouse' as 'nearest',
						external: externalTooltipHandler
					}
				}
			},
			plugins: [outerLabelsPlugin]
		};
		chart = new Chart(ctx, config);
	};

	$effect(() => {
		if (canvas && data && data.length > 0) {
			createChart();
		}
	});

	$effect(() => {
		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});
</script>

<div class="relative flex h-full w-full items-center justify-center">
	{#if data.length === 0 || data.every((d) => d.value === 0)}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
			<p>No channel data yet.</p>
		</div>
	{:else}
		<canvas bind:this={canvas}></canvas>
		<div
			bind:this={tooltipEl}
			class="pointer-events-none absolute z-50 min-w-[140px] rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl transition-opacity duration-200"
			style="opacity: 0; transform: translate(-50%, -100%) translateY(-8px);"
		></div>
	{/if}
</div>
