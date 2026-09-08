<script lang="ts">
	import { Plus, Users, Globe, Layout, GripVertical, CreditCard } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';

	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
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

<div class="min-h-[calc(100vh-56px)] bg-background">
	<main class="mx-auto max-w-6xl px-4 pt-8 pb-36 sm:px-6">
		<div class="mb-6 flex items-center justify-between">
			<Tabs.Root bind:value={filter}>
				<Tabs.List>
					<Tabs.Trigger value="all">
						<Globe class="mr-1.5 h-3.5 w-3.5" />
						All
					</Tabs.Trigger>
					<Tabs.Trigger value="owned">
						<Layout class="mr-1.5 h-3.5 w-3.5" />
						Owned
					</Tabs.Trigger>
					<Tabs.Trigger value="shared">
						<Users class="mr-1.5 h-3.5 w-3.5" />
						Shared
					</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>
			{#if data.entitlement?.saasEnabled && !data.entitlement.canAddWebsite}
				<Button href="/account?tab=billing" size="sm">
					<Plus class="mr-1 h-3.5 w-3.5" />
					{data.entitlement.tierName ? 'Upgrade' : 'Subscribe'}
				</Button>
			{:else}
				<Button href="/dashboard/new" size="sm">
					<Plus class="mr-1 h-3.5 w-3.5" />
					Add website
				</Button>
			{/if}
		</div>

		{#if isReady && filteredWebsites.length === 0}
			{#if data.websites.length === 0}
				<div class="mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center sm:py-20" in:fade={{ duration: 200 }}>
					<div class="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						{#if data.entitlement?.saasEnabled && !data.entitlement.canAddWebsite}
							<CreditCard class="h-6 w-6" />
						{:else}
							<Globe class="h-6 w-6" />
						{/if}
					</div>
					{#if data.entitlement?.saasEnabled && !data.entitlement.canAddWebsite}
						<h2 class="text-xl font-medium tracking-tight">Subscribe to get started</h2>
						<p class="mt-2 max-w-md text-sm text-muted-foreground">
							Your account doesn't have an active subscription yet. Choose a plan to start adding
							websites and collecting analytics.
						</p>
						<Button href="/account?tab=billing" class="mt-6">View plans</Button>
					{:else}
						{#if data.entitlement?.tierName}
							<a href="/account?tab=billing" class="mb-3 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600">{data.entitlement.tierName} plan</a>
						{/if}
						<h2 class="text-xl font-medium tracking-tight">Add your first website</h2>
						<p class="mt-2 max-w-md text-sm text-muted-foreground">
							Connect your site in under a minute — paste a tiny script and watch visitors show up
							in real time.
						</p>
						<ol class="mt-8 grid w-full gap-2 text-left sm:grid-cols-3">
							<li class="glass-card rounded-2xl p-4">
								<span class="mb-2 flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
								<p class="text-sm font-medium">Add your website</p>
								<p class="mt-1 text-xs text-muted-foreground">Register your domain</p>
							</li>
							<li class="glass-card rounded-2xl p-4">
								<span class="mb-2 flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
								<p class="text-sm font-medium">Install the script</p>
								<p class="mt-1 text-xs text-muted-foreground">Paste one snippet into your HTML</p>
							</li>
							<li class="glass-card rounded-2xl p-4">
								<span class="mb-2 flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
								<p class="text-sm font-medium">See live stats</p>
								<p class="mt-1 text-xs text-muted-foreground">Watch visitors in real time</p>
							</li>
						</ol>
						<Button href="/dashboard/new" class="mt-6">
							<Plus class="mr-1 h-3.5 w-3.5" />
							Add website
						</Button>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col items-center gap-3 py-16 text-center" in:fade={{ duration: 200 }}>
					<p class="text-sm text-muted-foreground">
						No {filter === 'owned' ? 'owned' : 'shared'} websites yet.
					</p>
					<Button variant="outline" size="sm" onclick={() => (filter = 'all')}>Show all websites</Button>
				</div>
			{/if}
		{:else}
		<div class="grid grid-cols-1 gap-3 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3 {isReady ? 'opacity-100' : 'opacity-0'}">
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
					class="group relative cursor-pointer rounded-2xl transition-opacity select-none {draggedId === site.id ? 'opacity-40' : 'opacity-100'} {dragOverId === site.id &&
					draggedId !== site.id
						? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
						: ''}"
				>
					<button
						aria-label="Drag to reorder"
						class="absolute top-2 right-2 z-20 cursor-grab rounded-full p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground active:cursor-grabbing"
						onclick={(e) => e.stopPropagation()}
						onmousedown={() => {
							_canDrag = true;
						}}
					>
						<GripVertical class="h-3.5 w-3.5" />
					</button>

					<div class="glass-card relative h-[158px] overflow-hidden rounded-2xl p-5 transition-colors hover:bg-accent/30">
						<div class="mb-8 flex items-center gap-2">
							<img src="https://icons.duckduckgo.com/ip3/{site.domain}.ico" alt="Icon" class="size-5 rounded-sm" />
							<span class="text-sm font-medium">{site.domain}</span>
							{#if !site.isOwner}
								<HoverCard.Root>
									<HoverCard.Trigger>
										<span class="ml-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
											<Users class="h-2.5 w-2.5" />
											Shared
										</span>
									</HoverCard.Trigger>
									<HoverCard.Content side="right" align="center" class="max-w-fit rounded-xl border-border">
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
											<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.15" />
											<stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
										</linearGradient>
									</defs>
									<path d={paths.area} fill="url(#gradient-{site.id.replace(/[^a-zA-Z0-9]/g, '-')})" />
									<path d={paths.line} fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
								</svg>
							{/if}
						</div>

						<div class="relative z-10 -mt-2.5 flex items-end justify-between">
							<span class="text-xs text-muted-foreground transition-colors group-hover:text-foreground">{site.visitors24h} visitors</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
		{/if}
	</main>
</div>
