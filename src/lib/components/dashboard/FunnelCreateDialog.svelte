<script lang="ts">
	import { Plus, Trash2, Globe, Target } from 'lucide-svelte';
	import type { FunnelStepDef } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	interface Props {
		websiteId: string;
		funnel?: { id: string; name: string; steps: FunnelStepDef[] } | null;
		onSave: (name: string, steps: FunnelStepDef[]) => Promise<void>;
		onClose: () => void;
	}

	let { websiteId, funnel = null, onSave, onClose }: Props = $props();

	let funnelName = $state('');
	let steps = $state<FunnelStepDef[]>([]);

	// Sync when editing an existing funnel
	$effect(() => {
		if (funnel) {
			untrack(() => {
				funnelName = funnel.name;
				steps = JSON.parse(JSON.stringify(funnel.steps || []));
			});
		}
	});

	let isSaving = $state(false);
	let saveError = $state('');

	// New step form
	let newStepName = $state('');
	let newStepType = $state<'page_visit' | 'goal'>('page_visit');
	let newStepValue = $state('');

	function addStep() {
		const name = newStepName.trim();
		const value = newStepValue.trim();
		if (!name || !value) return;

		steps = [...steps, { name, type: newStepType, value }];
		newStepName = '';
		newStepValue = '';
	}

	function removeStep(index: number) {
		steps = steps.filter((_, i) => i !== index);
	}

	function moveStep(from: number, to: number) {
		if (to < 0 || to >= steps.length) return;
		const arr = [...steps];
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		steps = arr;
	}

	// ── Save ────────────────────────────────────────────────────────────────────
	async function handleSave() {
		if (!funnelName.trim()) {
			saveError = 'Funnel name is required';
			return;
		}
		if (steps.length < 2) {
			saveError = 'Add at least 2 steps';
			return;
		}
		saveError = '';
		isSaving = true;
		try {
			await onSave(funnelName.trim(), steps);
			onClose();
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			isSaving = false;
		}
	}
</script>

<Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
	<Dialog.Content class="flex h-155 min-w-4xl flex-col gap-0 overflow-hidden p-0">
		<Dialog.Header class="shrink-0 border-b border-border px-6 py-4">
			<Dialog.Title class="text-sm font-medium text-muted-foreground">{funnel ? 'Edit Funnel' : 'Create Funnel'}</Dialog.Title>
		</Dialog.Header>

		<!-- Body -->
		<div class="flex min-h-0 flex-1 overflow-hidden">
			<!-- Left: step builder -->
			<div class="flex w-[52%] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border px-6 py-5">
				<div class="flex flex-col gap-1.5">
					<label for="funnel-name" class="text-xs font-medium text-muted-foreground">Name</label>

					<Input id="funnel-name" bind:value={funnelName} placeholder="Funnel name..." class="h-8 max-w-xs text-sm" />
				</div>

				<h3 class="text-sm font-semibold text-foreground">Add new step</h3>

				<!-- Step name -->
				<div class="flex flex-col gap-1.5">
					<label for="new-step-name" class="text-xs font-medium text-muted-foreground">Step name</label>
					<Input id="new-step-name" bind:value={newStepName} placeholder="Step name..." class="text-sm" onkeydown={(e) => e.key === 'Enter' && addStep()} />
				</div>

				<!-- Type toggle -->
				<div class="flex gap-0">
					<button
						onclick={() => (newStepType = 'page_visit')}
						class="flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors {newStepType === 'page_visit'
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						<Globe class="h-3.5 w-3.5" />
						Page visit
					</button>
					<button
						onclick={() => (newStepType = 'goal')}
						class="flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors {newStepType === 'goal'
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						<Target class="h-3.5 w-3.5" />
						Goal
					</button>
				</div>

				<!-- Value input -->
				{#if newStepType === 'page_visit'}
					<div class="flex flex-col gap-1.5">
						<label for="step-path" class="text-xs font-medium text-muted-foreground">Page URL path</label>
						<Input id="step-path" bind:value={newStepValue} placeholder="e.g. /pricing or /blog/%" class="text-sm" onkeydown={(e) => e.key === 'Enter' && addStep()} />
						<p class="text-[11px] text-muted-foreground">Use % as a wildcard. E.g. <code class="font-mono">/blog/%</code></p>
					</div>
				{:else}
					<div class="flex flex-col gap-1.5">
						<label for="step-event" class="text-xs font-medium text-muted-foreground">Visitor</label>
						<div class="flex gap-2">
							<div class="flex h-9 min-w-27.5 items-center justify-between rounded-md border border-border bg-muted/50 px-3 text-sm text-foreground">Completes</div>
							<Input id="step-event" bind:value={newStepValue} placeholder="e.g. signup, create_checkout" class="flex-1 text-sm" onkeydown={(e) => e.key === 'Enter' && addStep()} />
						</div>
						<p class="text-[11px] text-muted-foreground">Event name tracked via your analytics script.</p>
					</div>
				{/if}

				<!-- Add step button -->
				<Button onclick={addStep} disabled={!newStepName.trim() || !newStepValue.trim()} class="w-full gap-2">
					<Plus class="h-4 w-4" />
					Add step
				</Button>
			</div>

			<!-- Right: steps list -->
			<div class="flex flex-1 flex-col overflow-hidden px-6 py-5">
				<h3 class="mb-4 shrink-0 text-sm font-semibold text-foreground">Funnel steps</h3>

				{#if steps.length === 0}
					<div class="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted-foreground">
						<p>No steps yet.</p>
						<p class="mt-1 text-xs">Add steps to build your funnel.</p>
					</div>
				{:else}
					<ol class="flex flex-col gap-2 overflow-y-auto">
						{#each steps as step, i}
							<li class="group flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
								<!-- Reorder buttons -->
								<div class="flex flex-col gap-0.5 pt-0.5">
									<button
										onclick={() => moveStep(i, i - 1)}
										disabled={i === 0}
										class="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-20"
										aria-label="Move up"
									>
										<svg viewBox="0 0 8 8" class="h-2.5 w-2.5" fill="currentColor"><path d="M4 1L7 6H1z" /></svg>
									</button>
									<button
										onclick={() => moveStep(i, i + 1)}
										disabled={i === steps.length - 1}
										class="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-20"
										aria-label="Move down"
									>
										<svg viewBox="0 0 8 8" class="h-2.5 w-2.5" fill="currentColor"><path d="M4 7L1 2H7z" /></svg>
									</button>
								</div>

								<!-- Number + icon -->
								<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
									{i + 1}
								</span>

								<!-- Content -->
								<div class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="truncate text-sm font-semibold text-foreground">{step.name}</span>
									<span class="truncate text-[11px] text-muted-foreground">
										{step.type === 'page_visit' ? 'Page visit:' : 'Goal complete:'}&nbsp;
										<code class="font-mono">{step.value}</code>
									</span>
								</div>

								<!-- Remove -->
								<button
									onclick={() => removeStep(i)}
									class="mt-0.5 ml-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
									aria-label="Remove step"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<Dialog.Footer class="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
			{#if saveError}
				<p class="text-sm text-destructive">{saveError}</p>
			{:else}
				<p class="text-xs text-muted-foreground">{steps.length} step{steps.length !== 1 ? 's' : ''} defined</p>
			{/if}
			<div class="flex gap-2">
				<Button variant="ghost" onclick={onClose} disabled={isSaving}>Cancel</Button>
				<Button onclick={handleSave} disabled={isSaving || !funnelName.trim() || steps.length < 2} class="min-w-25">
					{isSaving ? 'Saving…' : funnel ? 'Update funnel' : 'Create funnel'}
				</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
