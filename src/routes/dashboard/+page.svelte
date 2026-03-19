<script lang="ts">
	import { Plus, Users, Globe, Layout, GripVertical } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: { data: PageData } = $props();

	let filter = $state('all');
	let customOrder = $state<string[] | null>(null);
	let isReady = $state(false);

	const getInitialOrder = () => {
		if (typeof localStorage === 'undefined') return null;
		const saved = localStorage.getItem('@owt-website-order');
		if (!saved) return null;
		try {
			return JSON.parse(saved);
		} catch {
			return null;
		}
	};

	$effect(() => {
		const saved = getInitialOrder();
		if (saved) customOrder = saved;
		isReady = true;
	});

	let orderedWebsites = $derived.by(() => {
		const order = customOrder ?? (typeof localStorage !== 'undefined' ? getInitialOrder() : null);
		const websites = [...data.websites];

		if (!order) return websites;

		return websites.sort((a, b) => {
			const ai = order.indexOf(a.id);
			const bi = order.indexOf(b.id);
			if (ai === -1 && bi === -1) return 0;
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
	});

	let filteredWebsites = $derived(
		orderedWebsites.filter((site) => {
			if (filter === 'owned') return site.isOwner;
			if (filter === 'shared') return !site.isOwner;
			return true;
		})
	);

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	let _pendingFrom = '';
	let _pendingTo = '';
	let _dropConfirmed = false;
	let _isDragging = false;
	let _canDrag = false;

	function handleDragStart(e: DragEvent, id: string) {
		if (!_canDrag) {
			e.preventDefault();
			return;
		}
		_isDragging = true;
		_pendingFrom = id;
		_pendingTo = '';
		_dropConfirmed = false;
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);

			const target = e.currentTarget as HTMLElement;
			if (target) {
				e.dataTransfer.setDragImage(target, 10, 10);
			}
		}
	}

	const handleDragOver = (e: DragEvent, id: string) => {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (draggedId && draggedId !== id) {
			dragOverId = id;
			_pendingTo = id;
		}
	};

	const handleDrop = (e: DragEvent, targetId: string) => {
		e.preventDefault();
		_pendingTo = targetId;
		_dropConfirmed = true;
	};

	const handleDragEnd = (e: DragEvent) => {
		e.preventDefault();

		if (_dropConfirmed && _pendingFrom && _pendingTo && _pendingFrom !== _pendingTo) {
			const current = [...orderedWebsites];
			const from = current.findIndex((w) => w.id === _pendingFrom);
			const to = current.findIndex((w) => w.id === _pendingTo);

			if (from !== -1 && to !== -1) {
				const newOrder = [...current];
				const [item] = newOrder.splice(from, 1);
				newOrder.splice(to, 0, item);
				const newOrderIds = newOrder.map((w) => w.id);
				customOrder = newOrderIds;
				localStorage.setItem('@owt-website-order', JSON.stringify(newOrderIds));
			}
		}

		draggedId = null;
		dragOverId = null;
		_pendingFrom = '';
		_pendingTo = '';
		_dropConfirmed = false;
		_canDrag = false;

		setTimeout(() => {
			_isDragging = false;
		}, 100);
	};

	const handleCardClick = (siteId: string) => {
		if (!_isDragging) goto(`/dashboard/${siteId}`);
	};

	const generateSparkline = (sparkline: { value: number }[]) => {
		if (sparkline.length < 2) return { area: '', line: '' };
		const maxVal = Math.max(...sparkline.map((d) => d.value), 1);
		const points = sparkline.map((d, i) => ({
			x: (i / (sparkline.length - 1)) * 100,
			y: 20 - (d.value / maxVal) * 18
		}));

		const linePath = (points: { x: number; y: number }[]) => {
			let d = `M${points[0].x},${points[0].y}`;
			for (let i = 0; i < points.length - 1; i++) {
				const p0 = points[Math.max(0, i - 1)];
				const p1 = points[i];
				const p2 = points[i + 1];
				const p3 = points[Math.min(points.length - 1, i + 2)];

				const cp1x = p1.x + (p2.x - p0.x) * 0.15;
				const cp1y = p1.y + (p2.y - p0.y) * 0.15;
				const cp2x = p2.x - (p3.x - p1.x) * 0.15;
				const cp2y = p2.y - (p3.y - p1.y) * 0.15;

				d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
			}
			return d;
		};

		const line = linePath(points);
		const area = `${line} L100,20 L0,20 Z`;

		return { area, line };
	};
</script>

<div class="min-h-screen bg-background">
	<main class="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="mb-6 flex items-center justify-between">
			<Tabs.Root bind:value={filter} class="w-[400px]">
				<Tabs.List>
					<Tabs.Trigger value="all">
						<Globe class="mr-2 h-4 w-4" />
						All
					</Tabs.Trigger>
					<Tabs.Trigger value="owned">
						<Layout class="mr-2 h-4 w-4" />
						Owned
					</Tabs.Trigger>
					<Tabs.Trigger value="shared">
						<Users class="mr-2 h-4 w-4" />
						Shared
					</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>
			<Button href="/dashboard/new" size="sm">
				<Plus class="mr-2 h-4 w-4" />
				Add website
			</Button>
		</div>

		<div class="grid grid-cols-1 gap-6 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3 {isReady ? 'opacity-100' : 'opacity-0'}">
			{#each isReady ? filteredWebsites : [] as site (site.id)}
				<div
					role="button"
					draggable="true"
					ondragstart={(e) => handleDragStart(e, site.id)}
					ondragover={(e) => handleDragOver(e, site.id)}
					ondrop={(e) => handleDrop(e, site.id)}
					ondragend={handleDragEnd}
					onclick={() => handleCardClick(site.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') handleCardClick(site.id);
					}}
					tabindex="0"
					class="group relative cursor-pointer rounded-lg transition-opacity select-none {draggedId === site.id ? 'opacity-40' : 'opacity-100'} {dragOverId === site.id &&
					draggedId !== site.id
						? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
						: ''}"
				>
					<button
						aria-label="Drag to reorder"
						class="absolute top-2 right-2 z-20 cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground active:cursor-grabbing"
						onclick={(e) => e.stopPropagation()}
						onmousedown={() => {
							_canDrag = true;
						}}
					>
						<GripVertical class="h-4 w-4" />
					</button>
					<Card.Root class="relative h-[158px] overflow-hidden transition-colors hover:bg-accent/50">
						<Card.Content class="p-5">
							<div class="mb-8 flex items-center gap-2">
								<img src="https://icons.duckduckgo.com/ip3/{site.domain}.ico" alt="Icon" class="mr-1.5 size-5" />
								<span class="text-sm font-bold">{site.domain}</span>
								{#if !site.isOwner}
									<HoverCard.Root>
										<HoverCard.Trigger>
											<span class="ml-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
												<Users class="h-3 w-3" />
												Shared
											</span>
										</HoverCard.Trigger>
										<HoverCard.Content side="right" align="center" class="max-w-fit">
											<div class="text-sm">{(site.owner as any)?.name || 'Unknown'}</div>
											<div class="text-xs text-muted-foreground">{(site.owner as any)?.email || 'Unknown'}</div>
										</HoverCard.Content>
									</HoverCard.Root>
								{/if}
							</div>

							<div class="absolute right-0 bottom-10 left-0 h-12">
								{#if site.sparkline && site.sparkline.length > 0}
									{@const paths = generateSparkline(site.sparkline)}
									<svg viewBox="0 0 100 20" class="h-full w-full overflow-visible" preserveAspectRatio="none">
										<defs>
											<linearGradient id="gradient-{site.id.replace(/[^a-zA-Z0-9]/g, '-')}" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.2" />
												<stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
											</linearGradient>
										</defs>
										<path d={paths.area} fill="url(#gradient-{site.id.replace(/[^a-zA-Z0-9]/g, '-')})" />
										<path d={paths.line} fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
									</svg>
								{/if}
							</div>

							<div class="relative z-10 -mt-2.5 flex items-end justify-between">
								<span class="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">{site.visitors24h} visitors</span>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			{/each}
		</div>
	</main>
</div>
