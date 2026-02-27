<script lang="ts" module>
	const getHostName = (url: string | null) => {
		if (!url) return 'Direct';
		try {
			return new URL(url).hostname;
		} catch {
			return url;
		}
	};
</script>

<script lang="ts">
	import { X, Monitor, Globe, ExternalLink, Activity, Search, Eye, Filter, XCircle, AppWindow } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
	import axios from 'axios';

	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	let { websiteId, visitor, highlightEventId, onClose } = $props();

	let loading = $state(true);
	let details = $state<any>(null);
	let error = $state<string | null>(null);
	let highlightedElement: HTMLElement | null = $state(null);
	let open = $state(true);

	let activeFilters = $state<string[]>([]);

	let toggleFilter = (filter: string) => {
		if (activeFilters.includes(filter)) {
			activeFilters = activeFilters.filter((f) => f !== filter);
		} else {
			activeFilters = [...activeFilters, filter];
		}
	};

	let clearFilters = () => {
		activeFilters = [];
	};

	let filterItems = (items: any[], filters: string[]) => {
		if (filters.length === 0) return items;
		return items.filter((item) => {
			if (filters.includes('Pageview') && (item.activityType === 'pageview' || item.pathname)) return true;
			if (filters.includes('Session') && item.type === 'session_start') return true;
			if (filters.includes('Events') && item.activityType === 'event') return true;
			return false;
		});
	};

	onMount(async () => {
		try {
			const { data } = await axios.get(`/api/websites/${websiteId}/visitors/${visitor.visitorId}`);
			details = data;
		} catch (e) {
			error = 'Failed to load visitor details';
			console.error(e);
		} finally {
			loading = false;
			if (highlightEventId) {
				await tick();
				setTimeout(() => {
					const el = document.getElementById(`event-${highlightEventId}`);
					if (el) {
						el.scrollIntoView({ behavior: 'smooth', block: 'center' });
						highlightedElement = el;
					}
				}, 100);
			}
		}
	});

	const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

	const getTimelineGroups = (journey: any[], filters: string[] = []) => {
		const items: any[] = [];

		journey.forEach((session) => {
			items.push({
				type: 'session_start',
				timestamp: session.startedAt,
				referrer: session.referrer,
				source: session.utmSource,
				id: `start-${session.id}`
			});

			if (session.activities) {
				session.activities.forEach((act: any) => {
					items.push({ ...act, id: act.id || `act-${act.timestamp}` });
				});
			}
		});

		let filteredItems = filterItems(items, filters);

		const groupsMap = new Map<string, any[]>();

		filteredItems.forEach((item) => {
			const date = new Date(item.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
			if (!groupsMap.has(date)) groupsMap.set(date, []);

			groupsMap.get(date)!.push(item);
		});

		const groups: { date: string; items: any[]; timestamp: number }[] = [];

		groupsMap.forEach((groupItems, date) => {
			groupItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

			const lastItem = groupItems[groupItems.length - 1];
			const timestamp = new Date(lastItem.timestamp).getTime();

			groups.push({ date, items: groupItems, timestamp });
		});

		groups.sort((a, b) => b.timestamp - a.timestamp);

		return groups;
	};

	let timelineGroups = $derived(details ? getTimelineGroups(details.journey, activeFilters) : []);

	const getOsIcon = (os: string | null) => {
		if (!os || os === 'Unknown') return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
		const lower = os.toLowerCase();
		if (lower.includes('win')) return 'https://api.iconify.design/logos:microsoft-windows.svg';
		if (lower.includes('mac')) return 'https://api.iconify.design/logos:apple.svg?color=white';
		if (lower.includes('android')) return 'https://api.iconify.design/logos:android-icon.svg';
		if (lower.includes('ios')) return 'https://api.iconify.design/logos:apple.svg?color=white';
		if (lower.includes('linux')) return 'https://api.iconify.design/logos:linux-tux.svg';
		return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
	};

	const getBrowserIcon = (browser: string | null) => {
		if (!browser || browser === 'Unknown') return 'https://api.iconify.design/lucide:globe.svg?color=%2371717a';
		const lower = browser.toLowerCase();
		if (lower.includes('chrome')) return 'https://api.iconify.design/logos:chrome.svg';
		if (lower.includes('firefox')) return 'https://api.iconify.design/logos:firefox.svg';
		if (lower.includes('safari')) return 'https://api.iconify.design/logos:safari.svg';
		if (lower.includes('edge')) return 'https://api.iconify.design/logos:microsoft-edge.svg';
		if (lower.includes('opera')) return 'https://api.iconify.design/logos:opera.svg';
		return 'https://api.iconify.design/lucide:globe.svg?color=%2371717a';
	};

	let region = $derived(visitor.region || details?.journey?.[0]?.region);
	let city = $derived(visitor.city || details?.journey?.[0]?.city);

	let device = $derived(visitor.device !== 'Unknown' ? visitor.device : details?.journey?.[0]?.deviceType || details?.visitor?.device || 'Unknown');
	let os = $derived(visitor.os !== 'Unknown' ? visitor.os : details?.journey?.[0]?.os || details?.visitor?.os || 'Unknown');
	let browser = $derived(visitor.browser !== 'Unknown' ? visitor.browser : details?.journey?.[0]?.browser || details?.visitor?.browser || 'Unknown');

	let osIcon = $derived(visitor.osIcon && visitor.os !== 'Unknown' ? visitor.osIcon : getOsIcon(os));
	let browserIcon = $derived(visitor.browserIcon && visitor.browser !== 'Unknown' ? visitor.browserIcon : getBrowserIcon(browser));

	let screenRes = $derived.by(() => {
		if (visitor.screenWidth && visitor.screenHeight) {
			return `${visitor.screenWidth}x${visitor.screenHeight}`;
		}
		const session = details?.journey?.[0];
		if (session?.screenWidth && session?.screenHeight) return `${session.screenWidth}x${session.screenHeight}`;

		return null;
	});

	let isPwa = $derived(visitor.isPwa ?? details?.journey?.[0]?.isPwa ?? false);

	function handleOpenChange(value: boolean) {
		open = value;
		if (!value) {
			onClose();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
		<Dialog.Close />

		<div class="-mx-6 flex-1 overflow-y-auto px-6">
			<div class="mb-6 border-b border-border pb-6">
				<div class="flex flex-col gap-6">
					<img src={visitor.avatar} alt={visitor.name} class="h-20 w-20 rounded-full bg-muted" />

					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-3">
							<h2 class="text-2xl font-bold">{visitor.name}</h2>
							{#if details?.visitor?.isCustomer}
								<Badge class="bg-[#3b82f6] hover:bg-[#3b82f6]/90">Customer</Badge>
							{/if}
						</div>

						<div class="flex flex-col gap-2.5 text-sm text-muted-foreground">
							<div class="flex items-center gap-3">
								{#if visitor.country !== 'Unknown'}
									<img src={visitor.countryFlag} alt={visitor.country} class="h-auto w-5 rounded-[2px]" />
									<span>
										{visitor.country}
										{#if region}, {region}{/if}
										{#if city}, {city}{/if}
									</span>
								{:else}
									<Globe class="h-5 w-5" />
									<span>Unknown Location</span>
								{/if}
							</div>

							<div class="flex items-center gap-3">
								<Monitor class="h-5 w-5" />
								<span>
									{device}
									<span class="text-muted-foreground"
										>{#if screenRes}({screenRes}){/if}</span
									>
								</span>
							</div>

							<div class="flex items-center gap-3">
								<img src={osIcon} alt={os} class="h-5 w-5 opacity-80" />
								<span>{os}</span>
							</div>

							<div class="flex items-center gap-3">
								<img src={browserIcon} alt={browser} class="h-5 w-5 opacity-80" />
								<span>{browser}</span>
							</div>

							{#if isPwa}
								<div class="flex items-center gap-3">
									<AppWindow class="h-5 w-5 text-primary" />
									<span class="font-medium text-primary">PWA Installed</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="min-h-[400px]">
				{#if loading}
					<div class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
						<div class="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
						<p>Loading journey...</p>
					</div>
				{:else if error}
					<div class="flex h-64 flex-col items-center justify-center text-destructive">
						<Activity class="mb-2 h-8 w-8 opacity-50" />
						<p>{error}</p>
					</div>
				{:else}
					<div class="-mx-6 border-b border-border bg-card px-6 py-3">
						<div class="flex flex-wrap items-center gap-2">
							<Filter class="h-4 w-4 text-muted-foreground" />
							<span class="mr-1 text-xs font-medium text-muted-foreground">Filter:</span>
							<Badge variant={activeFilters.includes('Pageview') ? 'default' : 'secondary'} class="cursor-pointer gap-1.5" onclick={() => toggleFilter('Pageview')}>
								<Eye class="h-3 w-3" />
								Pageview
							</Badge>
							<Badge variant={activeFilters.includes('Session') ? 'default' : 'secondary'} class="cursor-pointer gap-1.5" onclick={() => toggleFilter('Session')}>
								<Search class="h-3 w-3" />
								Session
							</Badge>
							<Badge variant={activeFilters.includes('Events') ? 'default' : 'secondary'} class="cursor-pointer gap-1.5" onclick={() => toggleFilter('Events')}>
								<Activity class="h-3 w-3" />
								Events
							</Badge>
							{#if activeFilters.length > 0}
								<Button variant="ghost" size="sm" onclick={clearFilters} class="h-auto gap-1 px-2 py-0 text-xs">
									<XCircle class="h-3.5 w-3.5" />
									Clear
								</Button>
							{/if}
						</div>
					</div>

					{#if timelineGroups.length > 0}
						<div>
							{#each timelineGroups as group}
								<div class="sticky top-0 z-10 -mx-6 border-b border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground">
									{group.date}
								</div>

								<div class="space-y-4 py-4">
									{#each group.items as item}
										<div
											id="event-{item.id}"
											class="group/item flex items-start gap-4 rounded-lg transition-all {highlightEventId === item.id ? 'bg-primary/10 p-3 ring-2 ring-primary/50' : 'p-1'}"
										>
											<div class="mt-0.5 shrink-0">
												{#if item.type === 'session_start'}
													<Search class="h-5 w-5 text-muted-foreground" />
												{:else if item.activityType === 'pageview' || item.pathname}
													<Eye class="h-5 w-5 text-muted-foreground" />
												{:else}
													<Activity class="h-5 w-5 text-amber-500/70" />
												{/if}
											</div>

											<div class="flex min-w-0 flex-1 items-baseline justify-between gap-4">
												<div class="truncate text-base">
													{#if item.type === 'session_start'}
														<span class="text-muted-foreground">Found via </span>
														<Badge variant="outline" class="text-xs">
															{#if item.referrer}
																<ExternalLink class="mr-1 inline h-3 w-3 align-text-bottom" />
															{/if}
															{item.referrer ? getHostName(item.referrer) : 'Direct'}
														</Badge>
													{:else if item.activityType === 'pageview' || item.pathname}
														<span class="text-muted-foreground">Viewed page </span>
														<Badge variant="secondary" class="font-medium">{item.pathname}</Badge>
													{:else}
														<div class="flex flex-col gap-1 whitespace-normal">
															<span>{item.name || item.type}</span>
															{#if item.data}
																<div class="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
																	{JSON.stringify(item.data)}
																</div>
															{/if}
														</div>
													{/if}
												</div>
												<div class="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
													{formatTime(item.timestamp)}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
							<p>{activeFilters.length > 0 ? 'No matching events' : 'No activity recorded'}</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
