<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { ChartType, ChartData, ChartOptions } from 'chart.js';
	import cn from '$lib/utils';

	let { class: className = '', type = 'line' as ChartType, data = { datasets: [] } as ChartData, options = {} as ChartOptions, ...rest } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined = undefined;

	onMount(() => {
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: type as ChartType,
			data: data as ChartData,
			options: options as ChartOptions
		});

		return () => {
			if (chart) chart.destroy();
		};
	});

	$effect(() => {
		if (chart) {
			chart.data = data as ChartData;
			chart.options = options as ChartOptions;
			chart.update();
		}
	});
</script>

<div class={cn('relative h-full w-full', className)} {...rest}>
	<canvas bind:this={canvas}></canvas>
</div>
