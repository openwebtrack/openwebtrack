<script lang="ts">
	import { Settings, Check, Copy, Trash2, Loader2, AlertTriangle } from 'lucide-svelte';
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

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let originalTimezone = $state(website.timezone);
	let originalDomain = $state(website.domain);
	let timezone = $state(website.timezone);
	let domain = $state(website.domain);
	let saveSuccess = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	let showDeleteModal = $state(false);
	let deleteConfirmText = $state('');
	let isDeleting = $state(false);

	let scriptCode = $derived(`<script defer data-website-id="${website.id}" data-domain="${domain}" src="${browser ? window.location.origin : ''}/script.js"><\/script>`);

	const hasChanges = $derived(domain !== originalDomain || timezone !== originalTimezone);

	$effect(() => {
		const w = website;
		if (!w?.id) return;
		originalTimezone = w.timezone;
		originalDomain = w.domain;
		timezone = w.timezone;
		domain = w.domain;
	});

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
			await axios.put(`/api/websites/${data.website.id}`, {
				domain,
				timezone
			});
			originalDomain = domain;
			originalTimezone = timezone;
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to update settings';
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
