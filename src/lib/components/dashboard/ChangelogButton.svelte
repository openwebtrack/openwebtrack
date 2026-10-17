<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { Sparkles, ArrowUpCircle, Copy, Check } from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { APP_VERSION, CHANGELOG, DOCKER_IMAGE, compareVersions } from '$lib/changelog';
	import { SAAS_MODE } from '$lib/config';

	const SEEN_KEY = 'owt:changelog-seen';

	let open = $state(false);
	let seenVersion = $state<string | null>(null);
	let mounted = $state(false);
	let latest = $state<string | null>(null);
	let copied = $state(false);

	const updateAvailable = $derived(!SAAS_MODE && latest !== null && compareVersions(latest, APP_VERSION) > 0);
	const unseen = $derived(seenVersion === null || compareVersions(APP_VERSION, seenVersion) > 0);
	const visible = $derived(mounted && (updateAvailable || unseen));

	const pullCommand = `docker pull ${DOCKER_IMAGE}:latest`;

	const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

	const typeLabel = { feature: 'New', fix: 'Fix', improvement: 'Improved' } as const;
	const typeClass = {
		feature: 'bg-primary/10 text-primary',
		fix: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
		improvement: 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
	} as const;

	onMount(() => {
		try {
			seenVersion = localStorage.getItem(SEEN_KEY);
		} catch {}
		mounted = true;

		// The cloud app is always on the latest version, so only the changelog is shown there
		if (SAAS_MODE) return;

		fetch('/api/version')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.latest) latest = data.latest;
			})
			.catch(() => {});
	});

	const openChangelog = () => {
		open = true;
		seenVersion = APP_VERSION;
		try {
			localStorage.setItem(SEEN_KEY, APP_VERSION);
		} catch {}
	};

	const copyCommand = async () => {
		try {
			await navigator.clipboard.writeText(pullCommand);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {}
	};
</script>

{#if visible}
	<button
		type="button"
		onclick={openChangelog}
		transition:fly={{ y: 12, duration: 200 }}
		class="fixed right-4 bottom-4 z-40 flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background/90 py-1.5 pr-3.5 pl-2.5 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent sm:right-6 sm:bottom-6"
	>
		<span class="relative flex">
			{#if updateAvailable}
				<ArrowUpCircle size={15} class="text-primary" />
			{:else}
				<Sparkles size={15} class="text-primary" />
			{/if}
			<span class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary ring-2 ring-background"></span>
		</span>
		{updateAvailable ? `Update available: v${latest}` : "What's new"}
	</button>
{/if}

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
		<Dialog.Header class="shrink-0 border-b border-border px-6 py-4">
			<Dialog.Title class="text-sm font-medium">Changelog</Dialog.Title>
			<Dialog.Description class="text-xs">You are running OpenWebTrack v{APP_VERSION}</Dialog.Description>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
			{#if updateAvailable}
				<div class="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
					<div class="flex items-center gap-2 text-sm font-medium">
						<ArrowUpCircle size={16} class="text-primary" />
						Upgrade recommended
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Version v{latest} is available. Pull the latest image and restart your container to upgrade.
					</p>
					<div class="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/50 py-1 pr-1 pl-3 font-mono text-xs">
						<code class="min-w-0 flex-1 break-all">{pullCommand}</code>
						<Button variant="ghost" size="icon-sm" class="h-7 w-7 shrink-0" onclick={copyCommand} aria-label="Copy command">
							{#if copied}<Check size={14} class="text-green-500" />{:else}<Copy size={14} />{/if}
						</Button>
					</div>
					<p class="mt-2 text-xs text-muted-foreground">
						Using Docker Compose? Run <code class="font-mono text-foreground">docker compose pull && docker compose up -d</code>
					</p>
				</div>
			{/if}

			<ol class="flex flex-col gap-6">
				{#each CHANGELOG as entry (entry.version)}
					<li>
						<div class="flex items-baseline gap-2">
							<h3 class="text-sm font-semibold">v{entry.version}</h3>
							{#if entry.version === APP_VERSION}
								<span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Current</span>
							{/if}
							<span class="ml-auto text-xs text-muted-foreground tabular-nums">{formatDate(entry.date)}</span>
						</div>
						<ul class="mt-2 flex flex-col gap-1.5">
							{#each entry.changes as change}
								<li class="flex items-start gap-2 text-sm text-muted-foreground">
									<span class="mt-0.5 w-15 shrink-0 rounded px-1.5 py-px text-center text-[10px] font-medium {typeClass[change.type]}">{typeLabel[change.type]}</span>
									<span class="min-w-0">{change.text}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>
		</div>
	</Dialog.Content>
</Dialog.Root>
