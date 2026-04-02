<script lang="ts">
	export interface FunnelStepResult {
		name: string;
		type: string;
		value: string;
		visitors: number;
	}

	interface Props {
		steps: FunnelStepResult[];
		conversionRate: number;
		funnelName?: string;
		dateRange?: string;
	}

	let { steps, conversionRate, funnelName = '', dateRange = 'Last 30 days' }: Props = $props();

	const VW = 1000; // viewBox width
	const CHART_TOP = 14;
	const CHART_H = 210;
	const LABEL_H = 64;
	const VH = CHART_TOP + CHART_H + LABEL_H;
	const CENTER_Y = CHART_TOP + CHART_H / 2;

	const N = $derived(steps.length);
	const colW = $derived(N > 0 ? VW / N : VW);
	const halfColW = $derived(colW * 0.24);
	const maxV = $derived(steps[0]?.visitors || 1);

	// Minimum fraction so we always render a visible ribbon (3px out of CHART_H)
	const MIN_FRAC = 3 / 210;

	const bounds = $derived(
		steps.map((s, i) => {
			const cx = i * colW + colW / 2;
			const frac = Math.max(s.visitors / maxV, MIN_FRAC);
			const bH = frac * CHART_H;
			return {
				cx,
				lx: cx - halfColW,
				rx: cx + halfColW,
				topY: CENTER_Y - bH / 2,
				botY: CENTER_Y + bH / 2,
				frac
			};
		})
	);

	function buildPath(b: typeof bounds): string {
		if (b.length === 0) return '';
		if (b.length === 1) {
			const s = b[0];
			return `M${s.lx},${s.topY} L${s.rx},${s.topY} L${s.rx},${s.botY} L${s.lx},${s.botY}Z`;
		}

		// Top edge left→right
		let d = `M${b[0].lx},${b[0].topY}`;
		for (let i = 0; i < b.length; i++) {
			d += ` L${b[i].rx},${b[i].topY}`;
			if (i < b.length - 1) {
				const mx = (b[i].rx + b[i + 1].lx) / 2;
				d += ` C${mx},${b[i].topY} ${mx},${b[i + 1].topY} ${b[i + 1].lx},${b[i + 1].topY}`;
			}
		}

		// Right cap + bottom edge right→left
		const last = b[b.length - 1];
		d += ` L${last.rx},${last.botY} L${last.lx},${last.botY}`;
		for (let i = b.length - 1; i >= 1; i--) {
			const mx = (b[i - 1].rx + b[i].lx) / 2;
			d += ` C${mx},${b[i].botY} ${mx},${b[i - 1].botY} ${b[i - 1].rx},${b[i - 1].botY}`;
			d += ` L${b[i - 1].lx},${b[i - 1].botY}`;
		}
		return d + 'Z';
	}

	const funnelPath = $derived(buildPath(bounds));

	const badges = $derived(
		steps.slice(1).map((s, i) => {
			const prev = steps[i];
			const pct = prev.visitors > 0 ? (((s.visitors - prev.visitors) / prev.visitors) * 100).toFixed(1) : '0.0';
			const b0 = bounds[i];
			const b1 = bounds[i + 1];
			const mx = (b0.rx + b1.lx) / 2;
			return { x: mx, y: CENTER_Y, text: `${pct}% →` };
		})
	);

	function fmt(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
		return String(n);
	}
</script>

<div class="w-full">
	<!-- Header bar -->
	<div class="mb-3 flex items-start justify-between gap-4 px-1">
		<div>
			<p class="text-base leading-tight font-semibold text-foreground">
				{conversionRate.toFixed(2)}% conversion rate
			</p>
			<p class="mt-0.5 text-xs text-muted-foreground">{dateRange}</p>
		</div>
	</div>

	<!-- Chart -->
	<svg viewBox="0 0 {VW} {VH}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Funnel chart" style="font-family: inherit;">
		<defs>
			<!-- Vertical gradient: dark outer edges, lighter centre -->
			<linearGradient id="funnel-grad-v" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="hsl(215 80% 22%)" />
				<stop offset="28%" stop-color="hsl(213 75% 42%)" />
				<stop offset="50%" stop-color="hsl(210 70% 54%)" />
				<stop offset="72%" stop-color="hsl(213 75% 42%)" />
				<stop offset="100%" stop-color="hsl(215 80% 22%)" />
			</linearGradient>
			<!-- Subtle horizontal gradient lightening toward right -->
			<linearGradient id="funnel-grad-h" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0%" stop-color="hsl(215 78% 32%)" stop-opacity="0" />
				<stop offset="100%" stop-color="hsl(210 65% 58%)" stop-opacity="0.18" />
			</linearGradient>
			<!-- Column divider style -->
		</defs>

		<!-- Subtle column separator lines -->
		{#each bounds as b, i}
			{#if i > 0}
				<line
					x1={b.lx - (b.cx - bounds[i - 1].cx) / 2 + halfColW}
					y1={CHART_TOP - 8}
					x2={b.lx - (b.cx - bounds[i - 1].cx) / 2 + halfColW}
					y2={CHART_TOP + CHART_H + 8}
					stroke="hsl(var(--border))"
					stroke-width="1"
					stroke-dasharray="3 4"
					opacity="0.4"
				/>
			{/if}
		{/each}

		<!-- Main funnel flow shape -->
		<path d={funnelPath} fill="url(#funnel-grad-v)" />
		<!-- Horizontal overlay gloss -->
		<path d={funnelPath} fill="url(#funnel-grad-h)" />

		<!-- Drop-off badges -->
		{#each badges as badge}
			{@const badgeW = 68}
			{@const badgeH = 22}
			<g>
				<rect x={badge.x - badgeW / 2} y={badge.y - badgeH / 2} width={badgeW} height={badgeH} rx="11" fill="hsl(0 0% 8% / 0.82)" />
				<text x={badge.x} y={badge.y + 4.5} text-anchor="middle" font-size="10.5" fill="hsl(0 0% 88%)" font-weight="500" letter-spacing="-0.2">
					{badge.text}
				</text>
			</g>
		{/each}

		<!-- Step labels -->
		{#each steps as step, i}
			{@const b = bounds[i]}
			{@const labelY = CHART_TOP + CHART_H + 18}
			<g>
				<!-- Visitor count -->
				<text x={b.cx} y={labelY} text-anchor="middle" font-size="12.5" style="fill: #fff;" font-weight="700">{fmt(step.visitors)} visitors</text>
				<!-- Step icon + name -->
				<text x={b.cx} y={labelY + 16} text-anchor="middle" font-size="11" style="fill: #7a706a;">
					{step.name}
				</text>
			</g>
		{/each}
	</svg>
</div>
