<script lang="ts">
	import { Settings, Check, Copy, Trash2, Loader2, AlertTriangle, Plus, X } from 'lucide-svelte';
	import { TIMEZONES } from '$lib/utils/constants';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let originalTimezone = $state(website.timezone);
	let originalDomain = $state(website.domain);
	let originalExtraDomains = $state<string[]>([...(website.extraDomains || [])]);
	let timezone = $state(website.timezone);
	let domain = $state(website.domain);
	let extraDomains = $state<string[]>([...(website.extraDomains || [])]);
	let newDomain = $state('');
	let domainError = $state('');
	let originalTrafficSpike = $state(false);
	let originalWeeklySummary = $state(false);
	let trafficSpikeEnabled = $state(false);
	let weeklySummaryEnabled = $state(false);
	let loadedWebsiteId = $state<string | null>(null);
	let saveSuccess = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	let showDeleteModal = $state(false);
	let deleteConfirmText = $state('');
	let isDeleting = $state(false);
	let cookieless = $state(false);

	let scriptCode = $derived(
		`<script defer data-website-id="${website.id}" data-domain="${domain}" src="${browser ? window.location.origin : ''}/${cookieless ? 'script.cookieless.js' : 'script.js'}"><\/script>`
	);

	const hasChanges = $derived(
		domain !== originalDomain ||
			timezone !== originalTimezone ||
			JSON.stringify(extraDomains) !== JSON.stringify(originalExtraDomains) ||
			trafficSpikeEnabled !== originalTrafficSpike ||
			weeklySummaryEnabled !== originalWeeklySummary
	);

	$effect(() => {
		const w = website;
		if (!w?.id) return;
		originalTimezone = w.timezone;
		originalDomain = w.domain;
		originalExtraDomains = [...(w.extraDomains || [])];
		timezone = w.timezone;
		domain = w.domain;
		extraDomains = [...(w.extraDomains || [])];
		// Sync toggles only when navigating between websites — never after a
		// save, or the stale layout data would reset them.
		if (loadedWebsiteId !== w.id) {
			loadedWebsiteId = w.id;
			const notifs = w.notifications as {
				trafficSpike?: { enabled?: boolean; threshold?: number; windowSeconds?: number };
				weeklySummary?: { enabled?: boolean };
			} | null | undefined;
			originalTrafficSpike = notifs?.trafficSpike?.enabled ?? false;
			originalWeeklySummary = notifs?.weeklySummary?.enabled ?? false;
			trafficSpikeEnabled = originalTrafficSpike;
			weeklySummaryEnabled = originalWeeklySummary;
		}
	});

	const normalizeDomainInput = (value: string): string =>
		value
			.toLowerCase()
			.trim()
			.replace(/^https?:\/\//, '')
			.replace(/^www\./, '')
			.split('/')[0]
			.split(':')[0];

	const addDomain = () => {
		const norm = normalizeDomainInput(newDomain);
		domainError = '';
		if (!norm) return;
		if (norm === normalizeDomainInput(domain) || extraDomains.includes(norm)) {
			domainError = 'Domain already added';
			return;
		}
		extraDomains = [...extraDomains, norm];
		newDomain = '';
	};

	const removeDomain = (d: string) => {
		extraDomains = extraDomains.filter((x) => x !== d);
	};

	const copyToClipboard = () => navigator.clipboard.writeText(scriptCode);

	const saveSettings = async () => {
		if (!domain.trim()) {
			saveError = 'Domain is required';
			return;
		}

		isSaving = true;
		saveError = '';
		saveSuccess = false;

		try {
			const stored = data.website.notifications as {
				trafficSpike?: { enabled?: boolean; threshold?: number; windowSeconds?: number };
				weeklySummary?: { enabled?: boolean };
			} | null | undefined;
			await axios.put(`/api/websites/${data.website.id}`, {
				domain,
				timezone,
				extraDomains,
				notifications: {
					trafficSpike: {
						enabled: trafficSpikeEnabled,
						threshold: stored?.trafficSpike?.threshold ?? 100,
						windowSeconds: stored?.trafficSpike?.windowSeconds ?? 60
					},
					weeklySummary: {
						enabled: weeklySummaryEnabled
					}
				}
			});
			originalDomain = domain;
			originalTimezone = timezone;
			originalExtraDomains = [...extraDomains];
			originalTrafficSpike = trafficSpikeEnabled;
			originalWeeklySummary = weeklySummaryEnabled;
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (e: any) {
			saveError = e.response?.data?.error || (e instanceof Error ? e.message : 'Failed to update settings');
		} finally {
			isSaving = false;
		}
	};

	const deleteWebsite = async () => {
		if (deleteConfirmText !== 'DELETE') return;

		isDeleting = true;

		try {
			await axios.delete(`/api/websites/${data.website.id}`);
			goto('/dashboard');
		} catch (e) {
			console.error(e);
		} finally {
			isDeleting = false;
		}
	};
</script>

<svelte:head>
	<title>Settings - {domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Script</Card.Title>
		<Card.Description>
			Paste this snippet in the <code class="rounded bg-muted px-1 py-0.5 text-muted-foreground">&lt;head&gt;</code> of your website.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="group relative">
			<div class="absolute top-1/2 right-3 -translate-y-1/2">
				<Button variant="secondary" size="icon-sm" onclick={copyToClipboard}>
					<Copy size={16} />
				</Button>
			</div>
			<pre class="w-full overflow-x-auto rounded-lg border bg-muted p-4 text-sm [&::-webkit-scrollbar]:hidden">{scriptCode}</pre>
		</div>
		<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm select-none">
			<input type="checkbox" bind:checked={cookieless} class="h-4 w-4 cursor-pointer accent-primary" />
			<span class="flex items-center gap-x-2">
				<svg
					class="size-7"
					xmlns="http://www.w3.org/2000/svg"
					shape-rendering="geometricPrecision"
					text-rendering="geometricPrecision"
					image-rendering="optimizeQuality"
					fill-rule="evenodd"
					clip-rule="evenodd"
					viewBox="0 0 512 356.18"
					><path
						fill="#039"
						fill-rule="nonzero"
						d="M28.137 0H483.86C499.337 0 512 12.663 512 28.14v299.9c0 15.477-12.663 28.14-28.14 28.14H28.137C12.663 356.18 0 343.517 0 328.04V28.14C0 12.663 12.663 0 28.137 0z"
					/><path
						fill="#FC0"
						d="M237.179 53.246h14.378L256 39.572l4.443 13.674h14.378l-11.633 8.451 4.444 13.673L256 66.919l-11.632 8.451 4.444-13.673-11.633-8.451zm0 237.458h14.378L256 277.03l4.443 13.674h14.378l-11.633 8.451 4.444 13.673L256 304.377l-11.632 8.451 4.444-13.673-11.633-8.451zM118.45 171.975h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.443 13.673-11.631-8.451-11.632 8.451 4.444-13.673-11.633-8.451zm59.363-102.796h14.377l4.443-13.674 4.443 13.674h14.378l-11.632 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm-43.429 43.429h14.378l4.442-13.673 4.444 13.673h14.377l-11.632 8.451 4.443 13.674-11.632-8.451-11.631 8.451 4.443-13.674-11.632-8.451zm-.032 118.737h14.377l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm43.471 43.46h14.378l4.443-13.674 4.443 13.674h14.378l-11.632 8.451 4.443 13.674-11.632-8.451-11.631 8.451 4.443-13.674-11.633-8.451zm178.085-102.83h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.444 13.673-11.632-8.451-11.631 8.451 4.443-13.673-11.633-8.451zM296.546 69.179h14.378l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.632-8.451zm43.429 43.429h14.377l4.444-13.673 4.442 13.673h14.378l-11.632 8.451 4.443 13.674-11.631-8.451-11.632 8.451 4.443-13.674-11.632-8.451zm.033 118.737h14.377l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm-43.473 43.46h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.443 13.674-11.631-8.451-11.632 8.451 4.443-13.674-11.632-8.451z"
					/></svg
				>
				Cookieless mode <span class="text-xs text-muted-foreground">(GDPR-friendly, no cookies)</span></span
			>
		</label>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Domain</Card.Title>
		<Card.Description>Your main website domain for analytics tracking.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="relative flex-1">
			<Input bind:value={domain} placeholder="example.com" />
		</div>
		<div class="mt-5">
			<Label class="mb-1 block">Additional domains</Label>
			<p class="mb-2 text-xs text-muted-foreground">
				Receive traffic from more domains in this same website, e.g. <code class="rounded bg-muted px-1">cloud.example.com</code>. The tracking snippet stays unchanged.
			</p>
			{#if extraDomains.length > 0}
				<div class="mb-2 flex flex-wrap gap-2">
					{#each extraDomains as d}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs">
							{d}
							<button onclick={() => removeDomain(d)} class="text-muted-foreground hover:text-foreground" aria-label="Remove {d}">
								<X size={12} />
							</button>
						</span>
					{/each}
				</div>
			{/if}
			<div class="flex gap-2">
				<Input
					bind:value={newDomain}
					placeholder="cloud.example.com"
					onkeydown={(e) => {
						if (e.key === 'Enter') addDomain();
					}}
				/>
				<Button variant="outline" onclick={addDomain} class="shrink-0">
					<Plus size={14} class="mr-1" />
					Add
				</Button>
			</div>
			{#if domainError}
				<p class="mt-2 text-xs text-destructive">{domainError}</p>
			{/if}
		</div>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Timezone</Card.Title>
		<Card.Description>This defines what "today" means in your reports.</Card.Description>
	</Card.Header>
	<Card.Content>
		<Select.Root bind:value={timezone} type="single">
			<Select.Trigger class="w-full">
				{timezone}
			</Select.Trigger>
			<Select.Content>
				{#each TIMEZONES as tz}
					<Select.Item value={tz} label={tz} />
				{/each}
			</Select.Content>
		</Select.Root>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Notifications</Card.Title>
		<Card.Description>Email alerts for your website.</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<div class="flex items-center justify-between gap-4">
			<div class="space-y-1">
				<p class="font-medium">Traffic spike alerts</p>
				<p class="text-sm text-muted-foreground">Receive an email when a sudden surge in visitors is detected</p>
			</div>
			<Switch checked={trafficSpikeEnabled} onCheckedChange={(checked: boolean) => (trafficSpikeEnabled = checked)} />
		</div>
		<div class="flex items-center justify-between gap-4">
			<div class="space-y-1">
				<p class="font-medium">Weekly summary</p>
				<p class="text-sm text-muted-foreground">Receive a weekly analytics report every Monday at 9 AM</p>
			</div>
			<Switch checked={weeklySummaryEnabled} onCheckedChange={(checked: boolean) => (weeklySummaryEnabled = checked)} />
		</div>
	</Card.Content>
</Card.Root>

{#if saveError}
	<Alert.Root variant="destructive" class="mt-6">
		<Alert.Description>{saveError}</Alert.Description>
	</Alert.Root>
{/if}

{#if saveSuccess}
	<Alert.Root class="mt-6 border-green-500/50 bg-green-500/10 text-green-500">
		<Check size={16} />
		<Alert.Title>Settings saved successfully!</Alert.Title>
	</Alert.Root>
{/if}

<div class="mt-6 flex justify-end gap-2">
	<Button onclick={saveSettings} disabled={!hasChanges || isSaving}>
		{#if isSaving}
			<Loader2 size={14} class="animate-spin" />
		{:else if saveSuccess}
			<Check size={14} />
		{/if}
		Save changes
	</Button>
</div>

<div class="mt-8 flex justify-end">
	<Button variant="ghost" size="sm" onclick={() => (showDeleteModal = true)} class="text-muted-foreground hover:text-destructive">
		<Trash2 size={12} class="mr-1" />
		Delete website
	</Button>
</div>

<Dialog.Root bind:open={showDeleteModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-destructive/10 p-2">
					<AlertTriangle class="h-5 w-5 text-destructive" />
				</div>
				<Dialog.Title>Delete Website</Dialog.Title>
			</div>
		</Dialog.Header>

		<p class="mb-4 text-sm text-muted-foreground">
			Are you sure you want to delete <span class="font-medium text-foreground">{domain}</span>? This action cannot be undone and all analytics data will be permanently lost.
		</p>

		<div class="mb-4">
			<Label for="delete-confirm-input" class="mb-2 block">
				Type <span class="text-destructive">DELETE</span> to confirm
			</Label>
			<Input id="delete-confirm-input" bind:value={deleteConfirmText} placeholder="DELETE" class="border-destructive focus-visible:ring-destructive" />
		</div>

		<Dialog.Footer class="gap-2">
			<Button
				variant="ghost"
				onclick={() => {
					showDeleteModal = false;
					deleteConfirmText = '';
				}}
			>
				Cancel
			</Button>
			<Button variant="destructive" onclick={deleteWebsite} disabled={deleteConfirmText !== 'DELETE' || isDeleting}>
				{#if isDeleting}
					<Loader2 size={14} class="animate-spin" />
				{/if}
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
