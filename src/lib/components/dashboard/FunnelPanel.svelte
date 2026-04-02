<script lang="ts">
	import { Plus, MoreVertical, Pencil, Trash2, Loader2, GitBranch, Menu } from 'lucide-svelte';
	import FunnelChart, { type FunnelStepResult } from './FunnelChart.svelte';
	import FunnelCreateDialog from './FunnelCreateDialog.svelte';
	import type { FunnelStepDef } from '$lib/server/db/schema';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { untrack } from 'svelte';
	import axios from 'axios';

	interface FunnelDef {
		id: string;
		name: string;
		steps: FunnelStepDef[];
		createdAt: string;
	}

	interface FunnelResults {
		steps: FunnelStepResult[];
		conversionRate: number;
	}

	interface Props {
		websiteId: string;
		startDate?: string | null;
		endDate?: string | null;
		dateRangeValue?: string;
		isOwner?: boolean;
		isDemo?: boolean;
	}

	let { websiteId, startDate = null, endDate = null, dateRangeValue = 'Last 7 days', isOwner = true, isDemo = false }: Props = $props();

	const canEdit = $derived(isOwner && !isDemo);

	// State
	let funnels = $state<FunnelDef[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let selectedFunnel = $state<FunnelDef | null>(null);
	let funnelResults = $state<FunnelResults | null>(null);
	let isLoadingResults = $state(false);
	let showCreateDialog = $state(false);
	let editingFunnel = $state<FunnelDef | null>(null);
	let openMenuId = $state<string | null>(null);
	let showSidebar = $state(true);

	const MOCK_FUNNELS: FunnelDef[] = [
		{
			id: 'demo-funnel-1',
			name: 'Main Conversion',
			createdAt: new Date().toISOString(),
			steps: [
				{ name: 'Landing Page', type: 'page_visit', value: '/' },
				{ name: 'Pricing', type: 'page_visit', value: '/pricing' },
				{ name: 'Signup Page', type: 'page_visit', value: '/signup' },
				{ name: 'Registration', type: 'goal', value: 'signup' }
			]
		},
		{
			id: 'demo-funnel-2',
			name: 'Blog Intake',
			createdAt: new Date().toISOString(),
			steps: [
				{ name: 'Blog Home', type: 'page_visit', value: '/blog' },
				{ name: 'Article', type: 'page_visit', value: '/blog/%' },
				{ name: 'Subscribe', type: 'goal', value: 'newsletter_signup' }
			]
		}
	];

	async function loadFunnels(keepSelection = false) {
		isLoading = true;
		loadError = '';
		try {
			if (isDemo) {
				funnels = MOCK_FUNNELS;
			} else {
				const res = await axios.get(`/api/websites/${websiteId}/funnels`);
				funnels = res.data;
			}
			if (!keepSelection || !selectedFunnel) {
				if (funnels.length > 0) {
					await openFunnel(funnels[0]);
				} else {
					selectedFunnel = null;
					funnelResults = null;
				}
			}
		} catch {
			loadError = 'Failed to load funnels';
		} finally {
			isLoading = false;
		}
	}

	async function openFunnel(f: FunnelDef) {
		selectedFunnel = f;
		funnelResults = null;
		isLoadingResults = true;
		try {
			if (isDemo) {
				await new Promise((r) => setTimeout(r, 400));
				const baseVisitors = 1000 + Math.floor(Math.random() * 500);
				const resultsSteps: any[] = f.steps.map((step, i) => {
					const dropoff = 0.6 + Math.random() * 0.2; // 60-80% stay
					const visitors = Math.floor(baseVisitors * Math.pow(dropoff, i));
					return {
						...step,
						visitors
					};
				});
				funnelResults = {
					steps: resultsSteps,
					conversionRate: (resultsSteps[resultsSteps.length - 1].visitors / resultsSteps[0].visitors) * 100
				};
			} else {
				const params = new URLSearchParams();
				if (startDate) params.set('start', startDate);
				if (endDate) params.set('end', endDate);
				const res = await axios.get(`/api/websites/${websiteId}/funnels/${f.id}/stats?${params}`);
				funnelResults = res.data;
			}
		} catch {
			funnelResults = { steps: [], conversionRate: 0 };
		} finally {
			isLoadingResults = false;
		}
	}

	$effect(() => {
		untrack(() => {
			if (selectedFunnel) {
				openFunnel(selectedFunnel);
			}
		});
	});

	async function handleSave(name: string, steps: FunnelStepDef[]) {
		const wasEditing = editingFunnel;
		if (wasEditing) {
			await axios.put(`/api/websites/${websiteId}/funnels/${wasEditing.id}`, { name, steps });
		} else {
			await axios.post(`/api/websites/${websiteId}/funnels`, { name, steps });
		}
		editingFunnel = null;
		await loadFunnels(!!wasEditing);
		if (wasEditing && selectedFunnel?.id === wasEditing.id) {
			const updated = funnels.find((f) => f.id === wasEditing.id);
			if (updated) await openFunnel(updated);
		}
	}

	async function deleteFunnel(f: FunnelDef) {
		if (!confirm(`Delete funnel "${f.name}"?`)) return;
		await axios.delete(`/api/websites/${websiteId}/funnels/${f.id}`);
		await loadFunnels(false);
	}

	$effect(() => {
		untrack(() => {
			if (websiteId || isDemo) {
				loadFunnels();
			}
		});
	});
</script>

<div class="flex h-full min-h-0 gap-0">
	<!-- Left: chart area -->
	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<!-- Sidebar toggle button (top-right of chart area) -->
		<button
			onclick={() => (showSidebar = !showSidebar)}
			class="absolute top-0 right-0 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Toggle funnel list"
			title={showSidebar ? 'Hide funnel list' : 'Show funnel list'}
		>
			<Menu class="h-3.5 w-3.5" />
		</button>

		{#if isLoading}
			<div class="flex h-full items-center justify-center">
				<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		{:else if loadError}
			<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<GitBranch class="h-7 w-7 opacity-40" />
				<p class="text-sm">{loadError}</p>
				<button onclick={() => loadFunnels()} class="text-xs text-primary underline">Retry</button>
			</div>
		{:else if !selectedFunnel}
			<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<GitBranch class="h-8 w-8 opacity-30" />
				<p class="text-sm font-medium">No funnels yet</p>
				<p class="text-xs">Create a funnel using the panel on the right.</p>
			</div>
		{:else if isLoadingResults}
			<div class="flex h-full items-center justify-center">
				<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		{:else if funnelResults && funnelResults.steps.length > 0}
			<div class="h-full overflow-y-auto pr-1">
				<FunnelChart steps={funnelResults.steps} conversionRate={funnelResults.conversionRate} funnelName={selectedFunnel.name} dateRange={dateRangeValue} />
			</div>
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<GitBranch class="h-7 w-7 opacity-30" />
				<p class="text-sm">No data for this period.</p>
				<p class="text-xs">Try a wider date range.</p>
			</div>
		{/if}
	</div>

	<!-- Right: funnel sidebar -->
	{#if showSidebar}
		<div class="flex w-40 shrink-0 flex-col border-l border-border pl-3">
			<ul class="flex-1 overflow-y-auto py-1">
				{#each funnels as f}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li
						class="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 transition-colors {selectedFunnel?.id === f.id
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
						onclick={() => openFunnel(f)}
						title={f.name}
					>
						{#if selectedFunnel?.id === f.id}
							<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
						{:else}
							<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-transparent"></span>
						{/if}
						<span class="min-w-0 flex-1 truncate text-xs leading-snug font-medium">{f.name}</span>
						{#if canEdit}
							<Popover.Root open={openMenuId === f.id} onOpenChange={(v) => (openMenuId = v ? f.id : null)}>
								<Popover.Trigger
									onclick={(e) => e.stopPropagation()}
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
									aria-label="Options"
								>
									<MoreVertical class="h-3 w-3" />
								</Popover.Trigger>
								<Popover.Content class="w-36 p-1" align="end">
									<button
										onclick={(e) => {
											e.stopPropagation();
											openMenuId = null;
											editingFunnel = f;
											showCreateDialog = true;
										}}
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
									>
										<Pencil class="h-3.5 w-3.5" />
										Edit
									</button>
									<button
										onclick={(e) => {
											e.stopPropagation();
											openMenuId = null;
											deleteFunnel(f);
										}}
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
									>
										<Trash2 class="h-3.5 w-3.5" />
										Delete
									</button>
								</Popover.Content>
							</Popover.Root>
						{/if}
					</li>
				{/each}
			</ul>
			{#if canEdit}
				<div class="shrink-0 border-t border-border pt-2 pb-1">
					<button
						onclick={() => {
							editingFunnel = null;
							showCreateDialog = true;
						}}
						class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground"
					>
						<Plus class="h-3.5 w-3.5" />
						Funnel
					</button>
				</div>
			{:else if !canEdit && funnels.length === 0}
				<div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
					<GitBranch class="h-8 w-8 text-muted-foreground/20" />
					<div>
						<p class="text-xs font-medium text-foreground">No funnels</p>
						<p class="mt-1 text-[11px] text-muted-foreground">Only owners can create funnels</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showCreateDialog}
	<FunnelCreateDialog
		{websiteId}
		funnel={editingFunnel}
		onSave={handleSave}
		onClose={() => {
			showCreateDialog = false;
			editingFunnel = null;
		}}
	/>
{/if}
