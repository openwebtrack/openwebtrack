<script lang="ts">
	import { User, Lock, ArrowLeft, Check, Loader2, LogOut, Bot, CreditCard, Shield, Trash2, Monitor, Smartphone, Globe, Unlink, AlertTriangle, KeyRound, Link2, Plus, Copy } from 'lucide-svelte';
	import authClient from '$lib/auth-client';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import BillingTab from '$lib/components/BillingTab.svelte';

	let { data }: { data: PageData } = $props();

	let activeTab = $state(
		(() => {
			const t = page.url.searchParams.get('tab');
			if (t === 'billing' && data.saasEnabled) return 'billing';
			if (t === 'password') return 'password';
			if (t === 'sessions') return 'sessions';
			if (t === 'providers') return 'providers';
			if (t === 'mcp') return 'mcp';
			if (t === 'danger') return 'danger';
			return 'profile';
		})()
	);

	const setTab = (tab: string) => {
		activeTab = tab;
		const url = new URL(page.url);
		url.searchParams.set('tab', tab);
		replaceState(url, {});
	};

	// Profile state
	let name = $state('');
	$effect(() => {
		name = data.user.name ?? '';
	});
	let isSavingProfile = $state(false);
	let profileError = $state('');
	let profileSuccess = $state(false);

	// Password state
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSavingPassword = $state(false);
	let passwordError = $state('');
	let passwordSuccess = $state(false);

	// Sessions state
	let sessions = $state<any[]>([]);
	let accounts = $state<any[]>([]);
	let loadingSessions = $state(false);
	let revokingId = $state<string | null>(null);

	// Providers state
	let loadingProviders = $state(false);
	let linkingProvider = $state<string | null>(null);
	let unlinkingId = $state<string | null>(null);

	// MCP state
	let keys = $state<any[]>([]);
	let loading = $state(false);
	let error = $state('');
	let dialogOpen = $state(false);
	let keyName = $state('My AI assistant');
	let createdKey = $state<string | null>(null);
	let copied = $state(false);
	let deleting = $state<string | null>(null);
	let configTab = $state('general');
	let loaded = false;

	const endpoint = $derived(data.mcpServerUrl);
	const generalConfig = $derived(JSON.stringify({ mcpServers: { openwebtrack: { url: endpoint, headers: { Authorization: 'Bearer YOUR_MCP_KEY' } } } }, null, 2));
	const codexConfig = $derived(`# ~/.codex/config.toml
[mcp_servers.openwebtrack]
url = "${endpoint}"
http_headers = {
  Authorization = "Bearer YOUR_MCP_KEY"
}`);

	// Danger zone state
	let deleteConfirm = $state('');
	let isDeleting = $state(false);
	let deleteError = $state('');

	const saveProfile = async () => {
		if (!name.trim()) {
			profileError = 'Name is required';
			return;
		}
		isSavingProfile = true;
		profileError = '';
		profileSuccess = false;
		try {
			const { error } = await authClient.updateUser({ name });
			if (error) {
				profileError = error.message || 'Failed to update profile';
			} else {
				profileSuccess = true;
				setTimeout(() => (profileSuccess = false), 2000);
			}
		} catch (e) {
			profileError = e instanceof Error ? e.message : 'Failed to update profile';
		} finally {
			isSavingProfile = false;
		}
	};

	const handleLogout = async () => {
		await authClient.signOut();
		goto('/auth');
	};

	const savePassword = async () => {
		if (!currentPassword || !newPassword || !confirmPassword) {
			passwordError = 'All fields are required';
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}
		if (newPassword.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			return;
		}
		isSavingPassword = true;
		passwordError = '';
		passwordSuccess = false;
		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword
			});
			if (error) {
				passwordError = error.message || 'Failed to change password';
			} else {
				passwordSuccess = true;
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				setTimeout(() => (passwordSuccess = false), 2000);
			}
		} catch (e) {
			passwordError = e instanceof Error ? e.message : 'Failed to change password';
		} finally {
			isSavingPassword = false;
		}
	};

	const loadSessions = async () => {
		loadingSessions = true;
		try {
			const result = await authClient.listSessions();
			if (result.data) {
				sessions = result.data;
			}
		} catch (e) {
			console.error('Failed to load sessions', e);
		} finally {
			loadingSessions = false;
		}
	};

	const revokeSession = async (token: string) => {
		revokingId = token;
		try {
			await authClient.revokeSession({ token });
			sessions = sessions.filter((s) => s.token !== token);
		} catch (e) {
			console.error('Failed to revoke session', e);
		} finally {
			revokingId = null;
		}
	};

	const revokeOtherSessions = async () => {
		try {
			await authClient.revokeOtherSessions();
			const currentToken = sessions.find((s) => s.current)?.token;
			sessions = currentToken ? sessions.filter((s) => s.token === currentToken) : [];
		} catch (e) {
			console.error('Failed to revoke sessions', e);
		}
	};

	const loadAccounts = async () => {
		try {
			const result = await authClient.listAccounts();
			if (result.data) {
				accounts = result.data;
			}
		} catch (e) {
			console.error('Failed to load accounts', e);
		}
	};

	const loadKeys = async () => {
		loading = true;
		try {
			const res = await fetch('/api/account/mcp');
			const data = await res.json();
			keys = data.keys || [];
		} catch (e: any) {
			error = e.message || 'Could not load MCP keys.';
		} finally {
			loading = false;
		}
	};

	const createKey = async () => {
		if (!keyName.trim()) return;
		error = '';
		try {
			const res = await fetch('/api/account/mcp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: keyName.trim() })
			});
			const data = await res.json();
			createdKey = data.key;
			const { key: _, ...row } = data;
			keys = [row, ...keys];
		} catch (e: any) {
			error = e.message || 'Could not create MCP key.';
		}
	};

	const removeKey = async (id: string) => {
		deleting = id;
		error = '';
		try {
			await fetch(`/api/account/mcp?keyId=${id}`, { method: 'DELETE' });
			keys = keys.filter((k) => k.id !== id);
		} catch (e: any) {
			error = e.message || 'Could not revoke MCP key.';
		} finally {
			deleting = null;
		}
	};

	const copy = async (value: string) => {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	};

	const closeDialog = () => {
		dialogOpen = false;
		createdKey = null;
		keyName = 'My AI assistant';
	};

	const linkProvider = async (provider: string) => {
		linkingProvider = provider;
		try {
			await authClient.signIn.social({ provider, callbackURL: '/account?tab=providers' });
		} catch (e) {
			console.error('Failed to link provider', e);
			linkingProvider = null;
		}
	};

	const unlinkAccount = async (accountId: string) => {
		unlinkingId = accountId;
		try {
			await authClient.unlinkAccount({ accountId });
			accounts = accounts.filter((a) => a.id !== accountId);
		} catch (e) {
			console.error('Failed to unlink account', e);
		} finally {
			unlinkingId = null;
		}
	};

	const isProviderLinked = (providerId: string) => {
		return accounts.some((a) => a.providerId === providerId);
	};

	const getLinkedAccountId = (providerId: string) => {
		return accounts.find((a) => a.providerId === providerId)?.id;
	};

	const deleteAccount = async () => {
		if (deleteConfirm !== data.user.email) return;
		isDeleting = true;
		deleteError = '';
		try {
			await authClient.deleteUser();
			await authClient.signOut();
			goto('/auth');
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'Failed to delete account';
			isDeleting = false;
		}
	};

	const getDeviceIcon = (userAgent: string | null) => {
		if (!userAgent) return Monitor;
		const ua = userAgent.toLowerCase();
		if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return Smartphone;
		return Monitor;
	};

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	$effect(() => {
		if (activeTab === 'sessions') {
			loadSessions();
		}
		if (activeTab === 'providers') {
			loadAccounts();
		}
		if (activeTab === 'mcp' && !loaded) {
			loaded = true;
			loadKeys();
		}
	});

	const sidebarItems = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'providers', label: 'Sign-in providers', icon: KeyRound },
		{ id: 'password', label: 'Password', icon: Lock },
		{ id: 'sessions', label: 'Sessions', icon: Shield },
		{ id: 'mcp', label: 'MCP access', icon: Bot },
		...(data.saasEnabled ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
		{ id: 'danger', label: 'Danger zone', icon: AlertTriangle }
	];
</script>

<svelte:head>
	<title>Account Settings</title>
</svelte:head>

<div class="min-h-screen bg-background p-8">
	<div class="mx-auto max-w-6xl">
		<div class="mb-8">
			<Button href="/dashboard" variant="ghost" class="mb-4 gap-2 text-muted-foreground">
				<ArrowLeft size={14} />
				Back
			</Button>
			<h1 class="text-2xl font-medium tracking-tight">Account settings</h1>
		</div>

		<div class="flex flex-col gap-8 md:flex-row">
			<div class="w-full shrink-0 md:w-56">
				<nav class="space-y-0.5">
					{#each sidebarItems as item}
						<Button variant={activeTab === item.id ? 'secondary' : 'ghost'} onclick={() => setTab(item.id)} class="w-full justify-start text-sm">
							<item.icon size={16} class="mr-2.5" />
							{item.label}
						</Button>
					{/each}
				</nav>
			</div>

			<div class="min-w-0 flex-1 pb-20">
				{#if activeTab === 'profile'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-lg">Profile</Card.Title>
								<Card.Description>Your account information.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								{#if profileError}
									<Alert.Root variant="destructive">
										{profileError}
									</Alert.Root>
								{/if}
								{#if profileSuccess}
									<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
										<Check size={16} />
										<Alert.Title>Profile updated successfully!</Alert.Title>
									</Alert.Root>
								{/if}

								<div class="flex items-center gap-4 rounded-xl border border-border p-4">
									<img src={`https://api.dicebear.com/9.x/glass/svg?seed=owt-${data.user.name}`} alt="Avatar" class="h-16 w-16 rounded-full bg-secondary" />
									<div>
										<p class="text-sm font-medium">{data.user.name}</p>
										<p class="text-xs text-muted-foreground">{data.user.email}</p>
										<p class="mt-1 text-[10px] text-muted-foreground">Member since {formatDate(data.user.createdAt)}</p>
									</div>
								</div>

								<div class="space-y-2">
									<Label for="email">Email</Label>
									<Input type="email" id="email" value={data.user.email} disabled class="cursor-not-allowed opacity-50" />
									<p class="text-[10px] text-muted-foreground">Contact support to change your email address.</p>
								</div>

								<div class="space-y-2">
									<Label for="name">Name</Label>
									<Input type="text" id="name" bind:value={name} />
								</div>

								<div class="flex justify-end">
									<Button onclick={saveProfile} disabled={isSavingProfile} class="gap-2">
										{#if isSavingProfile}
											<Loader2 size={14} class="animate-spin" />
										{:else if profileSuccess}
											<Check size={14} />
										{/if}
										Save changes
									</Button>
								</div>
							</Card.Content>
						</Card.Root>

						<div class="mt-4 flex justify-end">
							<Button variant="ghost" size="sm" onclick={handleLogout} class="gap-2 text-muted-foreground hover:text-foreground">
								<LogOut size={14} />
								Log out
							</Button>
						</div>
					</div>

				{:else if activeTab === 'password'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-lg">Change password</Card.Title>
								<Card.Description>Update your account password.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								{#if passwordError}
									<Alert.Root variant="destructive">
										{passwordError}
									</Alert.Root>
								{/if}
								{#if passwordSuccess}
									<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
										<Check size={16} />
										<Alert.Title>Password changed successfully!</Alert.Title>
									</Alert.Root>
								{/if}

								<div class="space-y-2">
									<Label for="current-password">Current password</Label>
									<Input type="password" id="current-password" bind:value={currentPassword} placeholder="Enter current password" />
								</div>

								<div class="space-y-2">
									<Label for="new-password">New password</Label>
									<Input type="password" id="new-password" bind:value={newPassword} placeholder="Enter new password" />
								</div>

								<div class="space-y-2">
									<Label for="confirm-password">Confirm new password</Label>
									<Input type="password" id="confirm-password" bind:value={confirmPassword} placeholder="Confirm new password" />
								</div>

								<div class="flex justify-end">
									<Button onclick={savePassword} disabled={isSavingPassword} class="gap-2">
										{#if isSavingPassword}
											<Loader2 size={14} class="animate-spin" />
										{:else if passwordSuccess}
											<Check size={14} />
										{/if}
										Change password
									</Button>
								</div>
							</Card.Content>
						</Card.Root>
					</div>

				{:else if activeTab === 'providers'}
					<div in:fade={{ duration: 200 }} class="space-y-6">
						<!-- Email & Password -->
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-lg">Sign-in providers</Card.Title>
								<Card.Description>Manage how you sign in to your account.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								<!-- Email / Password -->
								<div class="flex items-center justify-between rounded-xl border border-border p-4">
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
											<KeyRound size={18} class="text-muted-foreground" />
										</div>
										<div>
											<p class="text-sm font-medium">Email & password</p>
											<p class="text-xs text-muted-foreground">Sign in with your email and password</p>
										</div>
									</div>
									<div class="flex items-center gap-2">
										<span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">Enabled</span>
									</div>
								</div>

								<!-- Google -->
								{#if data.providers?.google}
									{@const linked = isProviderLinked('google')}
									{@const accountId = getLinkedAccountId('google')}
									<div class="flex items-center justify-between rounded-xl border border-border p-4">
										<div class="flex items-center gap-3">
											<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
												<Globe size={18} class="text-muted-foreground" />
											</div>
											<div>
												<p class="text-sm font-medium">Google</p>
												<p class="text-xs text-muted-foreground">
													{#if linked}
														Connected as {data.user.email}
													{:else}
														Sign in with your Google account
													{/if}
												</p>
											</div>
										</div>
										<div class="flex items-center gap-2">
											{#if linked}
												<span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">Connected</span>
												<Button
													variant="ghost"
													size="sm"
													onclick={() => accountId && unlinkAccount(accountId)}
													disabled={unlinkingId === accountId}
													class="text-muted-foreground hover:text-destructive"
												>
													{#if unlinkingId === accountId}
														<Loader2 size={14} class="animate-spin" />
													{:else}
														<Unlink size={14} />
													{/if}
													Disconnect
												</Button>
											{:else}
												<Button
													variant="outline"
													size="sm"
													onclick={() => linkProvider('google')}
													disabled={linkingProvider === 'google'}
												>
													{#if linkingProvider === 'google'}
														<Loader2 size={14} class="animate-spin" />
													{:else}
														<Link2 size={14} />
													{/if}
													Connect
												</Button>
											{/if}
										</div>
									</div>
								{:else}
									<div class="rounded-xl border border-border p-4 opacity-60">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
													<Globe size={18} class="text-muted-foreground" />
												</div>
												<div>
													<p class="text-sm font-medium">Google</p>
													<p class="text-xs text-muted-foreground">Not configured by administrator</p>
												</div>
											</div>
											<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Unavailable</span>
										</div>
									</div>
								{/if}

								<p class="text-[10px] text-muted-foreground">
									Connect additional sign-in providers to access your account through different methods.
								</p>
							</Card.Content>
						</Card.Root>
					</div>

				{:else if activeTab === 'mcp'}
					<div in:fade={{ duration: 200 }} class="space-y-6">
						<div class="mb-2">
							<h2 class="text-lg font-medium">MCP access</h2>
							<p class="text-sm text-muted-foreground">Connect one AI assistant to all websites your account owns or can access.</p>
						</div>
						{#if error}<Alert.Root variant="destructive" class="mb-6"><Alert.Description>{error}</Alert.Description></Alert.Root>{/if}

						<Card.Root>
							<Card.Header>
								<div class="flex items-start justify-between gap-4">
									<div>
										<Card.Title class="flex items-center gap-2"><Bot size={19} /> MCP keys</Card.Title>
										<Card.Description>Each key has read access to every website owned by you or shared with you.</Card.Description>
									</div>
									<Button size="sm" onclick={() => (dialogOpen = true)}><Plus size={15} class="mr-1" /> Generate key</Button>
								</div>
							</Card.Header>
							<Card.Content>
								{#if loading}
									<div class="flex justify-center py-5"><Loader2 class="animate-spin text-muted-foreground" size={20} /></div>
								{:else if keys.length === 0}
									<p class="py-4 text-sm text-muted-foreground">No MCP keys yet.</p>
								{:else}
									<div class="divide-y">
										{#each keys as key}
											<div class="flex items-center justify-between gap-4 py-3">
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
												>
													{#if deleting === key.id}
														<Loader2 size={15} class="animate-spin" />
													{:else}
														<Trash2 size={15} />
													{/if}
												</Button>
											</div>
										{/each}
									</div>
								{/if}
							</Card.Content>
						</Card.Root>

						<Card.Root>
							<Card.Header>
								<Card.Title>Connect your AI</Card.Title>
								<Card.Description>Add this remote MCP server to an AI client that supports Streamable HTTP.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-6">
								<div class="space-y-2">
									<Label>Server URL</Label>
									<div class="flex gap-2">
										<Input readonly value={data.mcpServerUrl} />
										<Button variant="outline" size="icon-sm" aria-label="Copy server URL" onclick={() => copy(data.mcpServerUrl)}>
											{#if copied}<Check size={15} />{:else}<Copy size={15} />{/if}
										</Button>
									</div>
								</div>
								<div class="space-y-2">
									<Label>Example configuration</Label>
									<Tabs.Root bind:value={configTab} class="gap-3">
										<Tabs.List>
											<Tabs.Trigger value="general">General</Tabs.Trigger>
											<Tabs.Trigger value="codex">Codex</Tabs.Trigger>
										</Tabs.List>
										<Tabs.Content value="general">
											<div class="relative rounded-md border bg-muted/40 p-4">
												<pre class="overflow-x-auto pr-8 text-xs leading-5">{generalConfig}</pre>
												<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2" aria-label="Copy general configuration" onclick={() => copy(generalConfig)}>
													<Copy size={15} />
												</Button>
											</div>
										</Tabs.Content>
										<Tabs.Content value="codex" class="space-y-3">
											<div class="relative rounded-md border bg-muted/40 p-4">
												<pre class="overflow-x-auto pr-8 text-xs leading-5">{codexConfig}</pre>
												<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2" aria-label="Copy Codex configuration" onclick={() => copy(codexConfig)}>
													<Copy size={15} />
												</Button>
											</div>
										</Tabs.Content>
									</Tabs.Root>
								</div>
							</Card.Content>
						</Card.Root>
					</div>

				{:else if activeTab === 'sessions'}
					<div in:fade={{ duration: 200 }} class="space-y-6">
						<!-- Active Sessions -->
						<Card.Root>
							<Card.Header>
								<div class="flex items-center justify-between">
									<div>
										<Card.Title class="text-lg">Active sessions</Card.Title>
										<Card.Description>Manage your active sessions across devices.</Card.Description>
									</div>
									{#if sessions.length > 1}
										<Button variant="outline" size="sm" onclick={revokeOtherSessions}>
											Revoke other sessions
										</Button>
									{/if}
								</div>
							</Card.Header>
							<Card.Content>
								{#if loadingSessions}
									<div class="flex justify-center py-8">
										<Loader2 class="animate-spin text-muted-foreground" size={20} />
									</div>
								{:else if sessions.length === 0}
									<p class="py-4 text-sm text-muted-foreground">No active sessions.</p>
								{:else}
									<div class="space-y-3">
										{#each sessions as session}
											{@const DeviceIcon = getDeviceIcon(session.userAgent)}
											<div class="flex items-center justify-between rounded-xl border border-border p-3">
												<div class="flex items-center gap-3">
													<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
														<DeviceIcon size={18} class="text-muted-foreground" />
													</div>
													<div>
														<div class="flex items-center gap-2">
															<p class="text-sm font-medium">
																{session.userAgent?.includes('Chrome') ? 'Chrome' : session.userAgent?.includes('Firefox') ? 'Firefox' : session.userAgent?.includes('Safari') ? 'Safari' : 'Browser'}
															</p>
															{#if session.current}
																<span class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">Current</span>
															{/if}
														</div>
														<p class="text-xs text-muted-foreground">
															{session.ipAddress || 'Unknown IP'} &middot; Last active {formatDate(session.updatedAt || session.createdAt)}
														</p>
													</div>
												</div>
												{#if !session.current}
													<Button
														variant="ghost"
														size="icon-sm"
														onclick={() => revokeSession(session.token)}
														disabled={revokingId === session.token}
													>
														{#if revokingId === session.token}
															<Loader2 size={14} class="animate-spin" />
														{:else}
															<Unlink size={14} />
														{/if}
													</Button>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</Card.Content>
						</Card.Root>

						<!-- Connected Accounts -->
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-lg">Connected accounts</Card.Title>
								<Card.Description>Manage third-party login providers.</Card.Description>
							</Card.Header>
							<Card.Content>
								{#if accounts.length === 0}
									<p class="py-4 text-sm text-muted-foreground">No connected accounts.</p>
								{:else}
									<div class="space-y-3">
										{#each accounts as acc}
											<div class="flex items-center justify-between rounded-xl border border-border p-3">
												<div class="flex items-center gap-3">
													<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
														{#if acc.providerId === 'google'}
															<Globe size={18} class="text-muted-foreground" />
														{:else}
															<Monitor size={18} class="text-muted-foreground" />
														{/if}
													</div>
													<div>
														<p class="text-sm font-medium capitalize">{acc.providerId}</p>
														<p class="text-xs text-muted-foreground">Connected {formatDate(acc.createdAt)}</p>
													</div>
												</div>
												<Button
													variant="ghost"
													size="icon-sm"
													onclick={() => unlinkAccount(acc.id)}
													class="text-muted-foreground hover:text-destructive"
												>
													<Unlink size={14} />
												</Button>
											</div>
										{/each}
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					</div>

				{:else if activeTab === 'billing' && data.saasEnabled}
					<BillingTab tiers={data.tiers} />

				{:else if activeTab === 'danger'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root class="border-destructive/30">
							<Card.Header>
								<Card.Title class="text-lg text-destructive">Danger zone</Card.Title>
								<Card.Description>Irreversible actions that affect your account.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								<div class="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
									<div class="flex items-start justify-between">
										<div>
											<p class="text-sm font-medium">Delete account</p>
											<p class="mt-1 text-xs text-muted-foreground">
												Permanently delete your account and all associated data. This action cannot be undone.
											</p>
										</div>
										<Dialog.Root>
											<Dialog.Trigger>
												<Button variant="destructive" size="sm">Delete account</Button>
											</Dialog.Trigger>
											<Dialog.Content class="max-w-md">
												<Dialog.Header>
													<Dialog.Title>Delete account</Dialog.Title>
													<Dialog.Description>
														This will permanently delete your account and all associated data. Type your email to confirm.
													</Dialog.Description>
												</Dialog.Header>
												<div class="space-y-4">
													{#if deleteError}
														<Alert.Root variant="destructive">
															{deleteError}
														</Alert.Root>
													{/if}
													<div class="space-y-2">
														<Label for="confirm-email">Email address</Label>
														<Input
															type="email"
															id="confirm-email"
															bind:value={deleteConfirm}
															placeholder={data.user.email}
														/>
													</div>
												</div>
												<Dialog.Footer>
													<Button variant="outline" onclick={() => { deleteConfirm = ''; }}>Cancel</Button>
													<Button
														variant="destructive"
														onclick={deleteAccount}
														disabled={deleteConfirm !== data.user.email || isDeleting}
													>
														{#if isDeleting}
															<Loader2 size={14} class="animate-spin" />
														{/if}
														Delete permanently
													</Button>
												</Dialog.Footer>
											</Dialog.Content>
										</Dialog.Root>
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<Dialog.Root
	bind:open={dialogOpen}
	onOpenChange={(open) => {
		if (!open) closeDialog();
	}}
>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{createdKey ? 'MCP key created' : 'Generate MCP key'}</Dialog.Title>
			<Dialog.Description>
				{createdKey ? 'Copy this key now. It will not be shown again.' : 'Name the AI client that will use this key.'}
			</Dialog.Description>
		</Dialog.Header>
		{#if createdKey}
			<div class="space-y-3">
				<div class="flex gap-2">
					<Input readonly value={createdKey} />
					<Button variant="outline" size="icon-sm" aria-label="Copy MCP key" onclick={() => copy(createdKey!)}>
						{#if copied}<Check size={15} />{:else}<Copy size={15} />{/if}
					</Button>
				</div>
				<Alert.Root>
					<Alert.Description class="text-xs">Store this key securely. It grants access to all websites available to your account.</Alert.Description>
				</Alert.Root>
			</div>
			<Dialog.Footer>
				<Button onclick={closeDialog}>Done</Button>
			</Dialog.Footer>
		{:else}
			<div class="space-y-2">
				<Label for="mcp-key-name">Key name</Label>
				<Input id="mcp-key-name" bind:value={keyName} maxlength={100} />
				<Dialog.Footer class="mt-4">
					<Button variant="outline" onclick={closeDialog}>Cancel</Button>
					<Button onclick={createKey} disabled={!keyName.trim()}>
						<KeyRound size={15} class="mr-1" /> Generate key
					</Button>
				</Dialog.Footer>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
