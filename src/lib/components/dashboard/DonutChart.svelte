<script lang="ts">
	import { Lightbulb } from 'lucide-svelte';
	import Chart from 'chart.js/auto';

	interface ChannelItem {
		label: string;
		value: number;
	}

	let { data = [] }: { data?: ChannelItem[] } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | undefined;

	const chartColors = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', '#ec4899'];

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

		chart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data: values,
						backgroundColor: colors,
						borderWidth: 0,
						hoverOffset: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '60%',
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
						padding: 10,
						cornerRadius: 8,
						displayColors: true,
						callbacks: {
							label: (context) => ` ${context.label}: ${context.raw}`
						}
					}
				}
			}
		});
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

<div class="relative flex h-48 w-full items-center justify-center">
	{#if data.length === 0 || data.every((d) => d.value === 0)}
		<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
			<Lightbulb class="mb-2 h-8 w-8 opacity-50" />
			<p>No channel data yet.</p>
		</div>
	{:else}
		<canvas bind:this={canvas}></canvas>
	{/if}
</div>

{#if data.length > 0 && !data.every((d) => d.value === 0)}
	<div class="mt-4 flex flex-col justify-center gap-2">
		{#each data as item, i}
			<div class="flex items-center justify-between text-sm">
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 rounded-full" style="background-color: {chartColors[i]}"></div>
					<span class="text-muted-foreground">{item.label}</span>
				</div>
				<span class="font-medium">{item.value}</span>
			</div>
		{/each}
	</div>
{/if}
