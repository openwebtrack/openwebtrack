<script lang="ts">
	/**
	 * DottedBackground — same halftone-dot look as the login screenshot,
	 * but with swappable procedural patterns (no image assets needed).
	 *
	 * Usage:
	 *   <DottedBackground pattern="blobs" seed={7} />
	 *   <DottedBackground pattern="world" />
	 *   <DottedBackground pattern="grid" />
	 *   <DottedBackground pattern="waves" />
	 *
	 * `seed` gives you a *different pattern* with the *same dotted style*
	 * — just bump the number until you like the arrangement.
	 */
	import { onMount } from 'svelte';

	type Pattern = 'blobs' | 'world' | 'grid' | 'waves';

	let {
		pattern = 'blobs' as Pattern,
		seed = 7,
		color = 'primary',
		gap = 11,
		maxDot = 2.4,
		minDot = 0.7,
		class: klass = ''
	}: {
		pattern?: Pattern;
		seed?: number;
		color?: string;
		gap?: number;
		maxDot?: number;
		minDot?: number;
		class?: string;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let wrap: HTMLDivElement | undefined = $state();

	function resolveColor(c: string): string {
		if (c === 'primary' || c === 'var(--primary)') {
			const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
			return v || 'oklch(0.7023 0.0794 64.6432)';
		}
		return c;
	}

	// Seeded PRNG (mulberry32) so each seed = different pattern layout
	function rng(seedNum: number) {
		let a = seedNum >>> 0 || 1;
		return () => {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	type Blob = { x: number; y: number; r: number; amp: number };

	function buildBlobs(w: number, h: number, s: number): Blob[] {
		const rand = rng(s * 1013 + 77);
		const n = 7 + Math.floor(rand() * 3); // 7-9 blobs
		const blobs: Blob[] = [];
		for (let i = 0; i < n; i++) {
			blobs.push({
				x: rand() * w,
				y: rand() * h,
				r: (0.1 + rand() * 0.22) * Math.max(w, h),
				amp: 0.55 + rand() * 0.45
			});
		}
		return blobs;
	}

	// Rough continent-like clusters to echo the world-map feel of the screenshot
	function buildWorld(w: number, h: number): Blob[] {
		const clusters: [number, number, number][] = [
			[0.16, 0.52, 0.19],
			[0.3, 0.32, 0.13],
			[0.36, 0.62, 0.15],
			[0.52, 0.38, 0.1],
			[0.68, 0.66, 0.14],
			[0.86, 0.38, 0.17],
			[0.78, 0.24, 0.08]
		];
		return clusters.map(([fx, fy, fr]) => ({
			x: fx * w,
			y: fy * h,
			r: fr * Math.max(w, h),
			amp: 1
		}));
	}

	// Cheap fbm detail so edges break up like the screenshot (not perfect circles)
	function detail(x: number, y: number, s: number): number {
		return (
			Math.sin(x * 0.012 + s) * Math.cos(y * 0.011 - s * 0.7) * 0.5 +
			Math.sin(x * 0.03 - s * 1.3 + y * 0.021) * 0.3 +
			Math.cos((x - y) * 0.008 + s * 2.1) * 0.2
		);
	}

	function fieldAt(x: number, y: number, w: number, h: number, blobs: Blob[], s: number): number {
		let v = 0;
		for (const b of blobs) {
			const dx = x - b.x;
			const dy = y - b.y;
			const d = Math.sqrt(dx * dx + dy * dy) / b.r;
			if (d < 1.6) v += b.amp * Math.exp(-d * d * 2.2);
		}
		v += detail(x, y, s) * 0.35;
		// Sparse speckle everywhere, dense inside blobs — like the reference
		v += 0.06;
		return v;
	}

	function draw() {
		if (!canvas || !wrap) return;
		const rect = wrap.getBoundingClientRect();
		const w = Math.max(1, rect.width);
		const h = Math.max(1, rect.height);
		const dpr = Math.min(2, window.devicePixelRatio || 1);

		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		const blobs =
			pattern === 'world' ? buildWorld(w, h) : pattern === 'blobs' ? buildBlobs(w, h, seed) : [];

		const fill = resolveColor(color);

		for (let gy = gap / 2; gy < h; gy += gap) {
			for (let gx = gap / 2; gx < w; gx += gap) {
				let v: number;
				if (pattern === 'grid') {
					const dx = (gx - w / 2) / (w / 2);
					const dy = (gy - h / 2) / (h / 2);
					const d = Math.sqrt(dx * dx + dy * dy);
					v = Math.max(0, 0.9 - d) + detail(gx, gy, seed) * 0.08;
				} else if (pattern === 'waves') {
					v =
						0.45 +
						0.4 * Math.sin(gx * 0.02 + Math.sin(gy * 0.015 + seed) * 2 + seed) *
							Math.cos(gy * 0.018 - seed * 0.5);
				} else {
					v = fieldAt(gx, gy, w, h, blobs, seed);
				}

				if (v < 0.12) continue;
				const t = Math.min(1, Math.max(0, (v - 0.12) / 0.9));
				const r = minDot + (maxDot - minDot) * t;
				const alpha = 0.08 + 0.75 * t;

				ctx.globalAlpha = alpha;
				ctx.fillStyle = fill;
				ctx.beginPath();
				ctx.arc(gx, gy, r, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
	}

	onMount(() => {
		draw();
		const ro = new ResizeObserver(() => draw());
		if (wrap) ro.observe(wrap);
		window.addEventListener('resize', draw);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', draw);
		};
	});

	$effect(() => {
		// Redraw when props change
		void pattern;
		void seed;
		void color;
		void gap;
		draw();
	});
</script>

<div bind:this={wrap} class={`pointer-events-none absolute inset-0 overflow-hidden ${klass}`} aria-hidden="true">
	<canvas bind:this={canvas} class="h-full w-full"></canvas>
	<!-- Soft vignette so the card stays readable in the middle -->
	<div
		class="absolute inset-0"
		style="background: radial-gradient(ellipse 55% 60% at 50% 50%, transparent 40%, var(--background) 100%); opacity: 0.55;"
	></div>
</div>
