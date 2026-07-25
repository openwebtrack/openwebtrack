<script lang="ts">
	import { ArrowLeft, Bot, Check, Copy, KeyRound, Loader2, Lock, Plus, Trash2, User } from 'lucide-svelte';
	import axios from 'axios';
	import type { PageData } from './$types';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: { data: PageData } = $props();
	type Key = { id: string; name: string; createdAt: string; lastUsedAt: string | null };
	let keys = $state<Key[]>([]);
	let loading = $state(true);
	let error = $state('');
	let dialogOpen = $state(false);
	let keyName = $state('My AI assistant');
	let createdKey = $state<string | null>(null);
	let copied = $state(false);
	let deleting = $state<string | null>(null);
	let loaded = false;
	let configTab = $state('general');
	$effect(() => {
		if (!loaded) {
			loaded = true;
			load();
		}
	});
	const load = async () => {
		loading = true;
		try {
			keys = (await axios.get('/api/account/mcp')).data.keys;
		} catch (e: any) {
			error = e.response?.data?.error || 'Could not load MCP keys.';
		} finally {
			loading = false;
		}
	};
	const createKey = async () => {
		if (!keyName.trim()) return;
		error = '';
		try {
			const response = await axios.post('/api/account/mcp', { name: keyName.trim() });
			createdKey = response.data.key;
			const { key: _, ...row } = response.data;
			keys = [row, ...keys];
		} catch (e: any) {
			error = e.response?.data?.error || 'Could not create MCP key.';
		}
	};
	const removeKey = async (id: string) => {
		deleting = id;
		error = '';
		try {
			await axios.delete(`/api/account/mcp?keyId=${id}`);
			keys = keys.filter((key) => key.id !== id);
		} catch (e: any) {
			error = e.response?.data?.error || 'Could not revoke MCP key.';
		} finally {
			deleting = null;
		}
	};
	const copy = async (value: string) => {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	};
	const endpoint = $derived(data.mcpServerUrl);
	const generalConfig = $derived(JSON.stringify({ mcpServers: { openwebtrack: { url: endpoint, headers: { Authorization: 'Bearer YOUR_MCP_KEY' } } } }, null, 2));
	const codexConfig = $derived(`# ~/.codex/config.toml
[mcp_servers.openwebtrack]
url = "${endpoint}"
http_headers = {
  Authorization = "Bearer YOUR_MCP_KEY"
}`);
	const closeDialog = () => {
		dialogOpen = false;
		createdKey = null;
		keyName = 'My AI assistant';
	};
</script>

<svelte:head><title>MCP access</title></svelte:head>

<div class="min-h-screen bg-background p-8">
	<div class="mx-auto max-w-6xl">
		<Button href="/dashboard" variant="ghost" class="mb-4 gap-2 text-muted-foreground"><ArrowLeft size={14} /> Back</Button>
		<div class="mb-8"><h1 class="text-2xl font-bold">Account Settings</h1></div>
		<div class="flex flex-col gap-8 md:flex-row">
			<div class="w-full shrink-0 md:w-64">
				<nav class="space-y-1">
					<Button variant="ghost" href="/account" class="w-full justify-start"><User size={18} class="mr-3" /> Profile</Button><Button
						variant="ghost"
						href="/account?tab=password"
						class="w-full justify-start"><Lock size={18} class="mr-3" /> Password</Button
					><Button variant="secondary" href="/account/mcp" class="w-full justify-start"><Bot size={18} class="mr-3" /> MCP access</Button>
				</nav>
			</div>
			<div class="min-w-0 flex-1 pb-20">
				<div class="mb-6">
					<h2 class="text-xl font-bold">MCP access</h2>
					<p class="mt-1 text-sm text-muted-foreground">Connect one AI assistant to all websites your account owns or can access.</p>
				</div>
				{#if error}<Alert.Root variant="destructive" class="mb-6"><Alert.Description>{error}</Alert.Description></Alert.Root>{/if}
				<Card.Root
					><Card.Header
						><div class="flex items-start justify-between gap-4">
							<div>
								<Card.Title class="flex items-center gap-2"><Bot size={19} /> MCP keys</Card.Title><Card.Description
									>Each key has read access to every website owned by you or shared with you.</Card.Description
								>
							</div>
							<Button size="sm" onclick={() => (dialogOpen = true)}><Plus size={15} class="mr-1" /> Generate key</Button>
						</div></Card.Header
					><Card.Content
						>{#if loading}<div class="flex justify-center py-5"><Loader2 class="animate-spin text-muted-foreground" size={20} /></div>{:else if keys.length === 0}<p
								class="py-4 text-sm text-muted-foreground"
							>
								No MCP keys yet.
							</p>{:else}<div class="divide-y">
								{#each keys as key}<div class="flex items-center justify-between gap-4 py-3">
										<div>
											<p class="text-sm font-medium">{key.name}</p>
											<p class="text-xs text-muted-foreground">
												Created {new Date(key.createdAt).toLocaleDateString()} · {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}` : 'Never used'}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Revoke ${key.name}`}
											disabled={deleting === key.id}
											onclick={() => removeKey(key.id)}
											class="text-muted-foreground hover:text-destructive"
											>{#if deleting === key.id}<Loader2 size={15} class="animate-spin" />{:else}<Trash2 size={15} />{/if}</Button
										>
									</div>{/each}
							</div>{/if}</Card.Content
					></Card.Root
				>
				<Card.Root class="mt-6"
					><Card.Header><Card.Title>Connect your AI</Card.Title><Card.Description>Add this remote MCP server to an AI client that supports Streamable HTTP.</Card.Description></Card.Header
					><Card.Content class="space-y-6"
						><div class="space-y-2">
							<Label>Server URL</Label>
							<div class="flex gap-2">
								<Input readonly value={endpoint} /><Button variant="outline" size="icon-sm" aria-label="Copy server URL" onclick={() => copy(endpoint)}
									>{#if copied}<Check size={15} />{:else}<Copy size={15} />{/if}</Button
								>
							</div>
						</div>
						<div class="space-y-2">
							<Label>Example configuration</Label><Tabs.Root bind:value={configTab} class="gap-3"
								><Tabs.List><Tabs.Trigger value="general">General</Tabs.Trigger><Tabs.Trigger value="codex">Codex</Tabs.Trigger></Tabs.List><Tabs.Content value="general"
									><div class="relative rounded-md border bg-muted/40 p-4">
										<pre class="overflow-x-auto pr-8 text-xs leading-5">{generalConfig}</pre>
										<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2" aria-label="Copy general configuration" onclick={() => copy(generalConfig)}
											><Copy size={15} /></Button
										>
									</div></Tabs.Content
								><Tabs.Content value="codex" class="space-y-3">
									<div class="relative rounded-md border bg-muted/40 p-4">
										<pre class="overflow-x-auto pr-8 text-xs leading-5">{codexConfig}</pre>
										<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2" aria-label="Copy Codex configuration" onclick={() => copy(codexConfig)}
											><Copy size={15} /></Button
										>
									</div></Tabs.Content
								></Tabs.Root
							>
						</div>
					</Card.Content></Card.Root
				>
			</div>
		</div>
	</div>
</div>

<Dialog.Root
	bind:open={dialogOpen}
	onOpenChange={(open) => {
		if (!open) closeDialog();
	}}
	><Dialog.Content class="max-w-md"
		><Dialog.Header
			><Dialog.Title>{createdKey ? 'MCP key created' : 'Generate MCP key'}</Dialog.Title><Dialog.Description
				>{createdKey ? 'Copy this key now. It will not be shown again.' : 'Name the AI client that will use this key.'}</Dialog.Description
			></Dialog.Header
		>{#if createdKey}<div class="space-y-3">
				<div class="flex gap-2">
					<Input readonly value={createdKey} /><Button variant="outline" size="icon-sm" aria-label="Copy MCP key" onclick={() => copy(createdKey!)}
						>{#if copied}<Check size={15} />{:else}<Copy size={15} />{/if}</Button
					>
				</div>
				<Alert.Root><Alert.Description class="text-xs">Store this key securely. It grants access to all websites available to your account.</Alert.Description></Alert.Root>
			</div>
			<Dialog.Footer><Button onclick={closeDialog}>Done</Button></Dialog.Footer>{:else}<div class="space-y-2">
				<Label for="mcp-key-name">Key name</Label><Input id="mcp-key-name" bind:value={keyName} maxlength={100} /><Dialog.Footer class="mt-4"
					><Button variant="outline" onclick={closeDialog}>Cancel</Button><Button onclick={createKey} disabled={!keyName.trim()}><KeyRound size={15} class="mr-1" /> Generate key</Button
					></Dialog.Footer
				>
			</div>{/if}</Dialog.Content
	></Dialog.Root
>
