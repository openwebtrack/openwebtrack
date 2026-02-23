<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Get computed styles for correct theme colors
		const computedStyle = getComputedStyle(document.documentElement);
		const chart1 = computedStyle.getPropertyValue('--chart-1').trim() || '#3b82f6';
		const chart2 = computedStyle.getPropertyValue('--chart-2').trim() || '#a855f7';
		const card = computedStyle.getPropertyValue('--card').trim() || '#fff';
		const foreground = computedStyle.getPropertyValue('--foreground').trim() || '#000';
		const mutedForeground = computedStyle.getPropertyValue('--muted-foreground').trim() || '#71717a';
		const border = computedStyle.getPropertyValue('--border').trim() || '#e4e4e7';

		// Create Gradients
		const gradientVisitors = ctx.createLinearGradient(0, 0, 0, 300);
		gradientVisitors.addColorStop(0, `color-mix(in srgb, ${chart1}, transparent 75%)`);
		gradientVisitors.addColorStop(1, `color-mix(in srgb, ${chart1}, transparent 100%)`);

		const gradientPageviews = ctx.createLinearGradient(0, 0, 0, 300);
		gradientPageviews.addColorStop(0, `color-mix(in srgb, ${chart2}, transparent 75%)`);
		gradientPageviews.addColorStop(1, `color-mix(in srgb, ${chart2}, transparent 100%)`);

		// Mock Data
		const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
		const visitors = Array.from({ length: 24 }, () => Math.floor(Math.random() * 50) + 10);
		const pageviews = visitors.map((v) => v * (Math.random() * 0.5 + 1.2));

		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Unique Visitors',
						data: visitors,
						borderColor: chart1,
						backgroundColor: gradientVisitors,
						borderWidth: 2,
						tension: 0.4,
						fill: true,
						pointRadius: 0,
						pointHoverRadius: 6,
						pointHoverBackgroundColor: chart1,
						pointHoverBorderColor: '#fff',
						pointHoverBorderWidth: 2
					},
					{
						label: 'Pageviews',
						data: pageviews,
						borderColor: chart2,
						backgroundColor: gradientPageviews,
						borderWidth: 2,
						borderDash: [5, 5],
						tension: 0.4,
						fill: true,
						pointRadius: 0,
						pointHoverRadius: 6,
						pointHoverBackgroundColor: chart2,
						pointHoverBorderColor: '#fff',
						pointHoverBorderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top',
						align: 'end',
						labels: {
							usePointStyle: true,
							boxWidth: 8,
							color: mutedForeground,
							font: {
								family: 'Geist',
								size: 12
							}
						}
					},
					tooltip: {
						backgroundColor: card,
						titleColor: foreground,
						bodyColor: mutedForeground,
						padding: 12,
						cornerRadius: 12,
						borderColor: border,
						borderWidth: 1,
						displayColors: true,
						titleFont: {
							family: 'Geist',
							size: 13,
							weight: 'bold'
						},
						bodyFont: {
							family: 'Geist',
							size: 12
						}
					}
				},
				scales: {
					x: {
						grid: {
							display: false
						},
						ticks: {
							maxTicksLimit: 8,
							color: '#71717a', // zinc-500
							font: {
								family: 'Geist',
								size: 11
							}
						}
					},
					y: {
						beginAtZero: true,
						grid: {
							color: 'rgba(255, 255, 255, 0.05)'
						},
						border: {
							display: false
						},
						ticks: {
							color: '#71717a', // zinc-500
							font: {
								family: 'Geist',
								size: 11
							}
						}
					}
				}
			}
		});

		return () => {
			chart.destroy();
		};
	});
</script>

<div class="h-full w-full">
	<canvas bind:this={canvas}></canvas>
</div>
