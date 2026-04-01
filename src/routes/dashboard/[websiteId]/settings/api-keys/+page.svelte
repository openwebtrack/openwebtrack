<script lang="ts">
	import { Key, Plus, Trash2, Copy, Check, Loader2, BookOpen, ExternalLink } from 'lucide-svelte';
	import type { PageData } from './$types';
	import axios from 'axios';
	import { page } from '$app/state';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	interface ApiKeyRow {
		id: string;
		name: string;
		lastUsedAt: string | null;
		createdAt: string;
	}

	let apiKeys = $state<ApiKeyRow[]>([]);
	let isLoadingKeys = $state(true);
	let keysLoaded = $state(false);

	let showCreateModal = $state(false);
	let newKeyName = $state('');
	let isCreating = $state(false);
	let createError = $state('');
	let newlyCreatedKey = $state<string | null>(null);
	let keyCopied = $state(false);

	let deleteError = $state('');
	let deletingId = $state<string | null>(null);
	let keyToDelete = $state<ApiKeyRow | null>(null);

	$effect(() => {
		if (!keysLoaded) {
			keysLoaded = true;
			loadApiKeys();
		}
	});

	const loadApiKeys = async () => {
		isLoadingKeys = true;
		try {
			const res = await axios.get(`/api/websites/${website.id}/api-keys`);
			apiKeys = res.data;
		} catch (e) {
			console.error('Failed to load API keys', e);
		} finally {
			isLoadingKeys = false;
		}
	};

	const createKey = async () => {
		if (!newKeyName.trim()) return;
		isCreating = true;
		createError = '';
		try {
			const res = await axios.post(`/api/websites/${website.id}/api-keys`, { name: newKeyName.trim() });
			newlyCreatedKey = res.data.key;
			const { key: _, ...keyRow } = res.data;
			apiKeys = [keyRow, ...apiKeys];
			newKeyName = '';
		} catch (e: any) {
			createError = e.response?.data?.error || 'Failed to create API key';
		} finally {
			isCreating = false;
		}
	};

	const copyKey = async () => {
		if (!newlyCreatedKey) return;
		await navigator.clipboard.writeText(newlyCreatedKey);
		keyCopied = true;
		setTimeout(() => (keyCopied = false), 2000);
	};

	const closeCreateModal = () => {
		showCreateModal = false;
		newKeyName = '';
		createError = '';
		newlyCreatedKey = null;
		keyCopied = false;
	};

	const deleteKey = async () => {
		if (!keyToDelete) return;
		deletingId = keyToDelete.id;
		deleteError = '';
		try {
			await axios.delete(`/api/websites/${website.id}/api-keys/${keyToDelete.id}`);
			apiKeys = apiKeys.filter((k) => k.id !== keyToDelete.id);
			keyToDelete = null;
		} catch (e: any) {
			deleteError = e.response?.data?.message || 'Failed to delete API key';
		} finally {
			deletingId = null;
		}
	};

	const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	const formatDateTime = (dateStr: string) =>
		new Date(dateStr).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

	const apiExample = $derived(`curl -X GET "${page.url.origin}/api/v1/${page.params.websiteId}/stats" \\
  -H "Authorization: Bearer YOUR_API_KEY"`);
</script>

<svelte:head>
	<title>API Keys - {website.domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title>API Keys</Card.Title>
				<Card.Description>Manage API keys for programmatic access to your analytics data.</Card.Description>
			</div>
			<Button onclick={() => (showCreateModal = true)} size="sm">
				<Plus size={14} class="mr-1" />
				New Key
			</Button>
		</div>
	</Card.Header>
	<Card.Content>
		{#if isLoadingKeys}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		{:else if apiKeys.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
				<Key class="mb-2 h-8 w-8 opacity-50" />
				<p>No API keys yet</p>
				<p class="text-sm">Create an API key to access analytics data programmatically.</p>
			</div>
		{:else}
			<div class="divide-y">
				{#each apiKeys as apiKey}
					<div class="flex items-center justify-between py-3">
						<div class="flex items-center gap-3">
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
								<Key size={14} class="text-muted-foreground" />
							</div>
							<div>
								<p class="text-sm font-medium">{apiKey.name}</p>
							</div>
						</div>
						<div class="flex items-center gap-4">
							<div class="text-right">
								<p class="text-xs text-muted-foreground">Created {formatDate(apiKey.createdAt)}</p>
								{#if apiKey.lastUsedAt}
									<p class="text-xs text-muted-foreground">Last used {formatDateTime(apiKey.lastUsedAt)}</p>
								{:else}
									<p class="text-xs text-muted-foreground">Never used</p>
								{/if}
							</div>
							<Button variant="ghost" size="icon-sm" onclick={() => (keyToDelete = apiKey)} disabled={deletingId === apiKey.id} class="text-muted-foreground hover:text-destructive">
								{#if deletingId === apiKey.id}
									<Loader2 size={14} class="animate-spin" />
								{:else}
									<Trash2 size={14} />
								{/if}
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6 border-primary/20 bg-primary/5">
	<Card.Header>
		<Card.Title class="flex items-center gap-2 text-primary">
			<BookOpen size={18} />
			How to use the API
		</Card.Title>
		<Card.Description>Use your API keys to fetch analytics data from our REST API.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<div class="relative rounded-lg bg-black/90 p-4 font-mono text-xs text-white">
				<pre class="overflow-x-auto whitespace-pre-wrap">{apiExample}</pre>
				<Button
					variant="ghost"
					size="icon-sm"
					class="absolute top-2 right-2 h-7 w-7 text-white/50 hover:bg-white/10 hover:text-white"
					onclick={() => {
						navigator.clipboard.writeText(apiExample);
					}}
				>
					<Copy size={14} />
				</Button>
			</div>

			<div class="flex items-center justify-between rounded-lg border bg-background p-4">
				<div class="space-y-1">
					<p class="text-sm font-medium">Looking for more details?</p>
					<p class="text-xs text-muted-foreground">Check out our documentation for full API reference and examples.</p>
				</div>
				<Button variant="outline" size="sm" href="https://openwebtrack.github.io/docs/api/stats" target="_blank" class="gap-2">
					Read API Docs
					<ExternalLink size={14} />
				</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<Dialog.Root
	bind:open={showCreateModal}
	onOpenChange={(open) => {
		if (!open) closeCreateModal();
	}}
>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{newlyCreatedKey ? 'API Key Created' : 'Create API Key'}</Dialog.Title>
			<Dialog.Description>
				{#if newlyCreatedKey}
					Copy your API key now — it will not be shown again.
				{:else}
					Give your API key a descriptive name so you can identify it later.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if newlyCreatedKey}
			<div class="space-y-3">
				<div class="flex w-full max-w-full items-center gap-2 rounded-md border bg-muted/50 p-2">
					<input type="text" readonly value={newlyCreatedKey} class="w-full flex-1 bg-transparent text-sm outline-none" />
					<Button variant="ghost" size="icon-sm" onclick={copyKey} class="h-8 w-8 shrink-0">
						{#if keyCopied}
							<Check size={14} class="text-green-500" />
						{:else}
							<Copy size={14} />
						{/if}
					</Button>
				</div>
				<Alert.Root>
					<Alert.Description class="text-xs">Store this key securely. You won't be able to view it again after closing this dialog.</Alert.Description>
				</Alert.Root>
			</div>
			<Dialog.Footer>
				<Button onclick={closeCreateModal}>Done</Button>
			</Dialog.Footer>
		{:else}
			<div class="space-y-4">
				<div>
					<Label for="key-name" class="mb-2 block">Key name</Label>
					<Input id="key-name" bind:value={newKeyName} placeholder="e.g. Production dashboard" onkeydown={(e) => e.key === 'Enter' && createKey()} />
				</div>

				{#if createError}
					<Alert.Root variant="destructive">
						<Alert.Description>{createError}</Alert.Description>
					</Alert.Root>
				{/if}
			</div>

			<Dialog.Footer class="gap-2">
				<Button variant="ghost" onclick={closeCreateModal}>Cancel</Button>
				<Button onclick={createKey} disabled={!newKeyName.trim() || isCreating}>
					{#if isCreating}
						<Loader2 size={14} class="animate-spin" />
					{/if}
					Create
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={!!keyToDelete} onOpenChange={(open) => !open && (keyToDelete = null)}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete API Key</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete the API key <span class="font-medium text-foreground">"{keyToDelete?.name}"</span>? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>

		{#if deleteError}
			<Alert.Root variant="destructive">
				<Alert.Description>{deleteError}</Alert.Description>
			</Alert.Root>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="ghost" onclick={() => (keyToDelete = null)} disabled={!!deletingId}>Cancel</Button>
			<Button variant="destructive" onclick={deleteKey} disabled={!!deletingId}>
				{#if deletingId}
					<Loader2 size={14} class="mr-2 animate-spin" />
				{/if}
				Delete Key
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
