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

	let isVertical = $state(false);

	$effect(() => {
		const check = () => (isVertical = window.innerWidth < 640);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	});

	const VW = 1000; // viewBox width
	const CHART_TOP = 14;
	const CHART_H = 210;
	const LABEL_H = 75; // Increased slightly for vertical
	const VH = CHART_TOP + CHART_H + LABEL_H;

	// For Vertical mode
	const V_VH = 600; // Further reduced from 750 (significantly shorter)
	const V_VW = 300; // Sightly narrower
	const V_CHART_LEFT = 58; // Further reduced from 65
	const V_CHART_W = 170; // Further reduced from 190
	const V_LABEL_W = 55; // Further reduced from 60

	const N = $derived(steps.length);

	// Derived logic for Horizontal (Desktop)
	const h_colW = $derived(N > 0 ? VW / N : VW);
	const h_halfColW = $derived(h_colW * 0.24);
	const h_maxV = $derived(steps[0]?.visitors || 1);
	const h_centerY = CHART_TOP + CHART_H / 2;

	// Derived logic for Vertical (Mobile)
	const v_rowH = $derived(N > 0 ? V_VH / N : V_VH);
	const v_halfRowH = $derived(v_rowH * 0.24);
	const v_centerX = V_CHART_LEFT + V_CHART_W / 2;

	// Minimum fraction so we always render a visible ribbon
	const MIN_FRAC = 3 / 210;

	const bounds = $derived(
		steps.map((s, i) => {
			const maxV = steps[0]?.visitors || 1;
			const frac = Math.max(s.visitors / maxV, MIN_FRAC);

			if (isVertical) {
				const cy = i * v_rowH + v_rowH / 2;
				const bW = frac * V_CHART_W;
				return {
					cx: v_centerX,
					cy,
					ty: cy - v_halfRowH,
					by: cy + v_halfRowH,
					lx: v_centerX - bW / 2,
					rx: v_centerX + bW / 2,
					frac
				};
			} else {
				const cx = i * h_colW + h_colW / 2;
				const bH = frac * CHART_H;
				return {
					cx,
					cy: h_centerY,
					lx: cx - h_halfColW,
					rx: cx + h_halfColW,
					ty: h_centerY - bH / 2,
					by: h_centerY + bH / 2,
					frac
				};
			}
		})
	);

	function buildPath(b: typeof bounds): string {
		if (b.length === 0) return '';
		if (b.length === 1) {
			const s = b[0];
			return `M${s.lx},${s.ty} L${s.rx},${s.ty} L${s.rx},${s.by} L${s.lx},${s.by}Z`;
		}

		if (isVertical) {
			// TOP edge left side (top to bottom)
			let d = `M${b[0].lx},${b[0].ty}`;
			for (let i = 0; i < b.length; i++) {
				d += ` L${b[i].lx},${b[i].by}`;
				if (i < b.length - 1) {
					const my = (b[i].by + b[i + 1].ty) / 2;
					d += ` C${b[i].lx},${my} ${b[i + 1].lx},${my} ${b[i + 1].lx},${b[i + 1].ty}`;
				}
			}
			// Bottom edge
			const last = b[b.length - 1];
			d += ` L${last.rx},${last.by} L${last.rx},${last.ty}`;
			// RIGHT edge (bottom to top)
			for (let i = b.length - 1; i >= 1; i--) {
				const my = (b[i - 1].by + b[i].ty) / 2;
				d += ` C${b[i].rx},${my} ${b[i - 1].rx},${my} ${b[i - 1].rx},${b[i - 1].by}`;
				d += ` L${b[i - 1].rx},${b[i - 1].ty}`;
			}
			return d + 'Z';
		} else {
			// Top edge left→right
			let d = `M${b[0].lx},${b[0].ty}`;
			for (let i = 0; i < b.length; i++) {
				d += ` L${b[i].rx},${b[i].ty}`;
				if (i < b.length - 1) {
					const mx = (b[i].rx + b[i + 1].lx) / 2;
					d += ` C${mx},${b[i].ty} ${mx},${b[i + 1].ty} ${b[i + 1].lx},${b[i + 1].ty}`;
				}
			}

			// Right cap + bottom edge right→left
			const last = b[b.length - 1];
			d += ` L${last.rx},${last.by} L${last.lx},${last.by}`;
			for (let i = b.length - 1; i >= 1; i--) {
				const mx = (b[i - 1].rx + b[i].lx) / 2;
				d += ` C${mx},${b[i].by} ${mx},${b[i - 1].by} ${b[i - 1].rx},${b[i - 1].by}`;
				d += ` L${b[i - 1].lx},${b[i - 1].by}`;
			}
			return d + 'Z';
		}
	}

	const funnelPath = $derived(buildPath(bounds));

	const badges = $derived(
		steps.slice(1).map((s, i) => {
			const prev = steps[i];
			const pct = prev.visitors > 0 ? (((s.visitors - prev.visitors) / prev.visitors) * 100).toFixed(1) : '0.0';
			const b0 = bounds[i];
			const b1 = bounds[i + 1];
			const mx = isVertical ? v_centerX : (b0.rx + b1.lx) / 2;
			const my = isVertical ? (b0.by + b1.ty) / 2 : h_centerY;
			return { x: mx, y: my, text: isVertical ? `${pct}% ↓` : `${pct}% →` };
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
	<svg viewBox="0 0 {isVertical ? V_VW : VW} {isVertical ? V_VH : VH}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Funnel chart" style="font-family: inherit;">
		<defs>
			<!-- Vertical gradient: dark outer edges, lighter centre -->
			<linearGradient id="funnel-grad-v" x1={isVertical ? '0' : '0'} y1={isVertical ? '0' : '0'} x2={isVertical ? '1' : '0'} y2={isVertical ? '0' : '1'}>
				<stop offset="0%" stop-color="hsl(215 80% 22%)" />
				<stop offset="28%" stop-color="hsl(213 75% 42%)" />
				<stop offset="50%" stop-color="hsl(210 70% 54%)" />
				<stop offset="72%" stop-color="hsl(213 75% 42%)" />
				<stop offset="100%" stop-color="hsl(215 80% 22%)" />
			</linearGradient>
			<!-- Subtle horizontal gradient lightening toward right -->
			<linearGradient id="funnel-grad-h" x1="0" y1="0" x2={isVertical ? '0' : '1'} y2={isVertical ? '1' : '0'}>
				<stop offset="0%" stop-color="hsl(215 78% 32%)" stop-opacity="0" />
				<stop offset="100%" stop-color="hsl(210 65% 58%)" stop-opacity="0.18" />
			</linearGradient>
			<!-- Column divider style -->
		</defs>

		<!-- Subtle column/row separator lines -->
		{#each bounds as b, i}
			{#if i > 0}
				{#if isVertical}
					<line
						x1={V_CHART_LEFT - 8}
						y1={b.ty - (b.cy - bounds[i - 1].cy) / 2 + v_halfRowH}
						x2={V_CHART_LEFT + V_CHART_W + 8}
						y2={b.ty - (b.cy - bounds[i - 1].cy) / 2 + v_halfRowH}
						stroke="hsl(var(--border))"
						stroke-width="1"
						stroke-dasharray="3 4"
						opacity="0.4"
					/>
				{:else}
					<line
						x1={b.lx - (b.cx - bounds[i - 1].cx) / 2 + h_halfColW}
						y1={CHART_TOP - 8}
						x2={b.lx - (b.cx - bounds[i - 1].cx) / 2 + h_halfColW}
						y2={CHART_TOP + CHART_H + 8}
						stroke="hsl(var(--border))"
						stroke-width="1"
						stroke-dasharray="3 4"
						opacity="0.4"
					/>
				{/if}
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
			{#if isVertical}
				<g>
					<!-- Visitor count (Left) -->
					<text x={V_CHART_LEFT - 10} y={b.cy - 1} text-anchor="end" font-size="10" style="fill: #fff;" font-weight="700">
						{fmt(step.visitors)}
					</text>
					<!-- Step name (Right) -->
					<foreignObject x={V_CHART_LEFT + V_CHART_W + 6} y={b.cy - 14} width={V_LABEL_W + 35} height="28">
						<div class="flex h-full w-full items-center justify-start text-start">
							<span class="line-clamp-2 text-[9px] leading-tight text-[#7a706a]">
								{step.name}
							</span>
						</div>
					</foreignObject>
				</g>
			{:else}
				{@const labelY = CHART_TOP + CHART_H + 18}
				<g>
					<!-- Visitor count -->
					<text x={b.cx} y={labelY} text-anchor="middle" font-size="12.5" style="fill: #fff;" font-weight="700">{fmt(step.visitors)} visitors</text>
					<!-- Step icon + name -->
					<foreignObject x={b.cx - h_colW * 0.45} y={labelY + 6} width={h_colW * 0.9} height="40">
						<div class="flex w-full items-start justify-center px-1 text-center">
							<span class="line-clamp-2 text-[11px] leading-tight text-[#7a706a]">
								{step.name}
							</span>
						</div>
					</foreignObject>
				</g>
			{/if}
		{/each}
	</svg>
</div>
