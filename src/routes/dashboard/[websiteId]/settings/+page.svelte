<script lang="ts">
	import { Settings, ArrowLeft, Check, Copy, Trash2, Loader2, AlertTriangle, Users, UserPlus, X, Database, Download, Upload } from 'lucide-svelte';
	import { TIMEZONES } from '$lib/constants';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: { data: PageData } = $props();

	let originalTimezone = $state(data.website.timezone);
	let originalDomain = $state(data.website.domain);
	let timezone = $state(data.website.timezone);
	let domain = $state(data.website.domain);
	let activeTab = $state('general');
	let saveSuccess = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	let showDeleteModal = $state(false);
	let deleteConfirmText = $state('');
	let isDeleting = $state(false);

	let teamMembers = $state<{ id: string; userId: string; email: string; name: string | null; image: string | null; createdAt: Date }[]>([]);
	let isLoadingTeam = $state(false);
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let isInviting = $state(false);
	let inviteError = $state('');

	let scriptCode = $derived(`<script defer data-website-id="${data.website.id}" data-domain="${domain}" src="${browser ? window.location.origin : ''}/script.js"><\/script>`);

	const hasChanges = $derived(domain !== originalDomain || timezone !== originalTimezone);

	const copyToClipboard = () => navigator.clipboard.writeText(scriptCode);

	const loadTeamMembers = async () => {
		isLoadingTeam = true;
		try {
			const res = await axios.get(`/api/websites/${data.website.id}/team`);
			teamMembers = res.data;
		} catch (e) {
			console.error('Failed to load team members', e);
		} finally {
			isLoadingTeam = false;
		}
	};

	const saveSettings = async () => {
		if (!domain.trim()) {
			saveError = 'Domain is required';
			return;
		}

		isSaving = true;
		saveError = '';
		saveSuccess = false;

		try {
			await axios.put(`/api/websites/${data.website.id}`, { domain, timezone });
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

	const inviteMember = async () => {
		if (!inviteEmail.trim()) return;

		isInviting = true;
		inviteError = '';

		try {
			const res = await axios.post(`/api/websites/${data.website.id}/team`, { email: inviteEmail });
			teamMembers = [...teamMembers, res.data];
			inviteEmail = '';
			showInviteModal = false;
		} catch (e: any) {
			inviteError = e.response?.data?.message || 'Failed to invite member';
		} finally {
			isInviting = false;
		}
	};

	const removeMember = async (memberId: string) => {
		try {
			await axios.delete(`/api/websites/${data.website.id}/team/${memberId}`);
			teamMembers = teamMembers.filter((m) => m.id !== memberId);
		} catch (e) {
			console.error('Failed to remove member', e);
		}
	};

	let isExporting = $state(false);
	let exportError = $state('');

	let isImporting = $state(false);
	let importError = $state('');
	let importSuccess = $state('');
	let importFile = $state<File | null>(null);
	let selectedPlatform = $state('umami');
	let importFiles = $state<File[]>([]);

	let showWipeModal = $state(false);
	let wipeConfirmText = $state('');
	let isWiping = $state(false);
	let wipeError = $state('');

	const platforms = [
		{ id: 'umami', label: 'Umami', description: 'Import website_event.csv from Umami export', icon: 'https://icons.duckduckgo.com/ip3/umami.is.ico' },
		{ id: 'plausible', label: 'Plausible', description: 'Import all CSV files from Plausible export (visitors, pages, browsers, etc.)', icon: 'https://icons.duckduckgo.com/ip3/plausible.io.ico' }
	];

	const exportToCsv = async () => {
		isExporting = true;
		exportError = '';

		try {
			const res = await axios.get(`/api/websites/${data.website.id}/export`, {
				responseType: 'blob'
			});

			const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `${domain.replace(/[^a-z0-9]/gi, '_')}_analytics_${new Date().toISOString().split('T')[0]}.csv`;
			link.click();
			URL.revokeObjectURL(link.href);
		} catch (e) {
			exportError = 'Failed to export data. Please try again.';
			console.error('Export error:', e);
		} finally {
			isExporting = false;
		}
	};

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			if (selectedPlatform === 'plausible' || selectedPlatform === 'ga') {
				importFiles = Array.from(target.files);
				importFile = null;
			} else {
				importFile = target.files[0];
				importFiles = [];
			}
			importError = '';
		}
	};

	const handleImport = async () => {
		if (selectedPlatform === 'plausible' || selectedPlatform === 'ga') {
			if (importFiles.length === 0) return;
		} else {
			if (!importFile) return;
		}

		isImporting = true;
		importError = '';
		importSuccess = '';

		const formData = new FormData();
		formData.append('platform', selectedPlatform);

		if (selectedPlatform === 'plausible' || selectedPlatform === 'ga') {
			for (const file of importFiles) {
				formData.append('files', file);
			}
		} else {
			formData.append('file', importFile!);
		}

		try {
			const res = await axios.post(`/api/websites/${data.website.id}/import`, formData, {
				headers: { 'Content-Type': 'multipart/form-data' }
			});

			importSuccess = res.data.message;
			importFile = null;
			importFiles = [];
			const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
			if (fileInput) fileInput.value = '';
		} catch (e: any) {
			importError = e.response?.data?.message || 'Failed to import data. Please check your file format.';
			console.error('Import error:', e);
		} finally {
			isImporting = false;
		}
	};

	const wipeData = async () => {
		if (wipeConfirmText !== 'WIPE') return;

		isWiping = true;
		wipeError = '';

		try {
			await axios.delete(`/api/websites/${data.website.id}/data`);
			showWipeModal = false;
			wipeConfirmText = '';
		} catch (e: any) {
			wipeError = e.response?.data?.message || 'Failed to wipe data. Please try again.';
			console.error('Wipe error:', e);
		} finally {
			isWiping = false;
		}
	};

	const sidebarItems = [
		{ id: 'general', label: 'General', icon: Settings },
		{ id: 'team', label: 'Team', icon: Users },
		{ id: 'data', label: 'Data', icon: Database }
	];

	$effect(() => {
		if (activeTab === 'team') {
			loadTeamMembers();
		}
	});

	$effect(() => {
		if (browser) {
			const params = new URLSearchParams(window.location.search);
			const tabParam = params.get('tab');
			if (tabParam === 'integrations') {
				activeTab = 'general';
			}
		}
	});
</script>

<svelte:head>
	<title>Settings - {domain}</title>
</svelte:head>

<div class="min-h-screen p-8">
	<div class="mx-auto max-w-6xl">
		<!-- Header -->
		<div class="mb-8">
			<Button variant="ghost" href="/dashboard/{data.website.id}" class="mb-4 gap-2 text-muted-foreground">
				<ArrowLeft size={14} />
				Back
			</Button>
			<h1 class="text-2xl font-bold">Settings for {domain}</h1>
		</div>

		<div class="flex flex-col gap-8 md:flex-row">
			<!-- Sidebar -->
			<div class="w-full shrink-0 md:w-64">
				<nav class="space-y-1">
					{#each sidebarItems as item}
						<Button variant={activeTab === item.id ? 'secondary' : 'ghost'} onclick={() => (activeTab = item.id)} class="w-full justify-start">
							<item.icon size={18} class="mr-3" />
							{item.label}
						</Button>
					{/each}
				</nav>
			</div>

			<!-- Main Content -->
			<div class="min-w-0 flex-1 space-y-8 pb-20">
				{#if activeTab === 'general'}
					<div in:fade={{ duration: 200 }}>
						<!-- Script Section -->
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

						<!-- Domain Section -->
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

						<!-- Timezone Section -->
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
					</div>
				{:else if activeTab === 'team'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<div class="flex items-center justify-between">
									<div>
										<Card.Title>Team Members</Card.Title>
										<Card.Description>Invite team members to view analytics for this website. They will have read-only access.</Card.Description>
									</div>
									<Button onclick={() => (showInviteModal = true)} size="sm">
										<UserPlus size={14} class="mr-1" />
										Invite
									</Button>
								</div>
							</Card.Header>
							<Card.Content>
								{#if isLoadingTeam}
									<div class="flex items-center justify-center py-8">
										<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
									</div>
								{:else if teamMembers.length === 0}
									<div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
										<Users class="mb-2 h-8 w-8 opacity-50" />
										<p>No team members yet</p>
										<p class="text-sm">Invite team members to share access to this website's analytics.</p>
									</div>
								{:else}
									<div class="divide-y">
										{#each teamMembers as member}
											<div class="flex items-center justify-between py-3">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
														{#if member.image}
															<img src={member.image} alt={member.name || member.email} class="h-8 w-8 rounded-full object-cover" />
														{:else}
															<span class="text-sm font-medium">{(member.name || member.email)[0].toUpperCase()}</span>
														{/if}
													</div>
													<div>
														<p class="text-sm font-medium">{member.name || member.email}</p>
														<p class="text-xs text-muted-foreground">{member.email}</p>
													</div>
												</div>
												<Button variant="ghost" size="icon-sm" onclick={() => removeMember(member.id)} class="text-muted-foreground hover:text-destructive">
													<X size={14} />
												</Button>
											</div>
										{/each}
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					</div>
				{:else if activeTab === 'data'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<Card.Title>Import Data</Card.Title>
								<Card.Description>Import analytics data from other analytics platforms.</Card.Description>
							</Card.Header>
							<Card.Content>
								<Tabs.Root bind:value={selectedPlatform} class="w-full">
									<Tabs.List class="mb-4">
										{#each platforms as platform}
											<Tabs.Trigger value={platform.id} class="gap-2">
												<img src={platform.icon} alt={platform.label} class="h-4 w-4" />
												{platform.label}
											</Tabs.Trigger>
										{/each}
									</Tabs.List>

									<Tabs.Content value="umami">
										<div class="mb-4 rounded-lg border bg-muted/50 p-4">
											<h4 class="mb-2 font-medium">Umami Import Instructions</h4>
											<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
												<li>
													Go to <a href="https://cloud.umami.is/settings/data" class="text-primary" target="_blank" rel="noopener">https://cloud.umami.is/settings/data</a>
												</li>
												<li>Click "Export" and go to your email to download data.</li>
												<li>Upload the <code class="rounded bg-muted px-1 py-0.5">website_event.csv</code> file below</li>
											</ol>
										</div>

										{#if importError}
											<Alert.Root variant="destructive" class="mb-4">
												<Alert.Description>{importError}</Alert.Description>
											</Alert.Root>
										{/if}
										{#if importSuccess}
											<Alert.Root class="mb-4 border-green-500/50 bg-green-500/10 text-green-500">
												<Check size={16} />
												<Alert.Description>{importSuccess}</Alert.Description>
											</Alert.Root>
										{/if}
										<div class="flex flex-col gap-4">
											<Input id="import-file-input-umami" type="file" accept=".csv" onchange={handleFileSelect} />
											<Button onclick={handleImport} disabled={!importFile || isImporting}>
												{#if isImporting}
													<Loader2 size={14} class="mr-2 animate-spin" />
												{:else}
													<Upload size={14} class="mr-2" />
												{/if}
												Import from Umami
											</Button>
										</div>
									</Tabs.Content>

									<Tabs.Content value="plausible">
										<div class="mb-4 rounded-lg border bg-muted/50 p-4">
											<h4 class="mb-2 font-medium">Plausible Import Instructions</h4>
											<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
												<li>
													Go to <span class="text-primary">https://plausible.io/&#123;website&#125;/settings/imports-exports</span> (replace "website" with your site ID)
												</li>
												<li>Download the latest export file.</li>
												<li>Upload <strong>all CSV files</strong> from the exported folder below</li>
												<li>Required: <code class="rounded bg-muted px-1 py-0.5">imported_visitors_*.csv</code></li>
											</ol>
										</div>

										{#if importError}
											<Alert.Root variant="destructive" class="mb-4">
												<Alert.Description>{importError}</Alert.Description>
											</Alert.Root>
										{/if}
										{#if importSuccess}
											<Alert.Root class="mb-4 border-green-500/50 bg-green-500/10 text-green-500">
												<Check size={16} />
												<Alert.Description>{importSuccess}</Alert.Description>
											</Alert.Root>
										{/if}
										<div class="flex flex-col gap-4">
											<Input id="import-file-input-plausible" type="file" accept=".csv" multiple onchange={handleFileSelect} />
											{#if importFiles.length > 0}
												<p class="text-sm text-muted-foreground">{importFiles.length} file(s) selected</p>
											{/if}
											<Button onclick={handleImport} disabled={importFiles.length === 0 || isImporting}>
												{#if isImporting}
													<Loader2 size={14} class="mr-2 animate-spin" />
												{:else}
													<Upload size={14} class="mr-2" />
												{/if}
												Import from Plausible
											</Button>
										</div>
									</Tabs.Content>

									<Tabs.Content value="ga">
										<div class="mb-4 rounded-lg border bg-muted/50 p-4">
											<h4 class="mb-2 font-medium">Google Analytics Import Instructions</h4>
											<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
												<li>
													Go to <a href="https://analytics.google.com/" class="text-primary" target="_blank" rel="noopener">Google Analytics</a> and open your GA4 property
												</li>
												<li>Navigate to Reports → View user engagement & retention → Pages and screens</li>
												<li>Click the Share icon → Download File → Download CSV</li>
												<li>Repeat for Browsers report: Reports → Tech → Overview → Share icon → Download File → Download CSV</li>
												<li>Upload the CSV file(s) below</li>
											</ol>
										</div>

										{#if importError}
											<Alert.Root variant="destructive" class="mb-4">
												<Alert.Description>{importError}</Alert.Description>
											</Alert.Root>
										{/if}
										{#if importSuccess}
											<Alert.Root class="mb-4 border-green-500/50 bg-green-500/10 text-green-500">
												<Check size={16} />
												<Alert.Description>{importSuccess}</Alert.Description>
											</Alert.Root>
										{/if}
										<div class="flex flex-col gap-4">
											<Input id="import-file-input-ga" type="file" accept=".csv" multiple onchange={handleFileSelect} />
											{#if importFiles.length > 0}
												<p class="text-sm text-muted-foreground">{importFiles.length} file(s) selected</p>
											{/if}
											<Button onclick={handleImport} disabled={importFiles.length === 0 || isImporting}>
												{#if isImporting}
													<Loader2 size={14} class="mr-2 animate-spin" />
												{:else}
													<Upload size={14} class="mr-2" />
												{/if}
												Import from Google Analytics
											</Button>
										</div>
									</Tabs.Content>
								</Tabs.Root>
							</Card.Content>
						</Card.Root>

						<Card.Root class="mt-6">
							<Card.Header>
								<Card.Title>Export Data</Card.Title>
								<Card.Description>Download your website analytics data as a CSV file.</Card.Description>
							</Card.Header>
							<Card.Content>
								<p class="mb-4 text-sm text-muted-foreground">
									Export all analytics data including pageviews, sessions, visitors, and events. The CSV file can be opened in spreadsheet applications like Excel or Google Sheets.
								</p>
								{#if exportError}
									<Alert.Root variant="destructive" class="mb-4">
										<Alert.Description>{exportError}</Alert.Description>
									</Alert.Root>
								{/if}
								<Button onclick={exportToCsv} disabled={isExporting}>
									{#if isExporting}
										<Loader2 size={14} class="mr-2 animate-spin" />
									{:else}
										<Download size={14} class="mr-2" />
									{/if}
									Export to CSV
								</Button>
							</Card.Content>
						</Card.Root>

						<Card.Root class="mt-6 border-destructive/50">
							<Card.Header>
								<Card.Title class="text-destructive">Wipe Data</Card.Title>
								<Card.Description>Permanently delete all analytics data for this website.</Card.Description>
							</Card.Header>
							<Card.Content>
								<p class="mb-4 text-sm text-muted-foreground">
									This will delete all pageviews, sessions, visitors, and events. The website itself will remain, but all historical data will be lost.
								</p>
								<Button variant="destructive" onclick={() => (showWipeModal = true)}>
									<Trash2 size={14} class="mr-2" />
									Wipe All Data
								</Button>
							</Card.Content>
						</Card.Root>
					</div>
				{/if}
			</div>
		</div>
	</div>
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

<Dialog.Root bind:open={showInviteModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Invite Team Member</Dialog.Title>
			<Dialog.Description>Enter the email address of the user you want to invite. They must already have an account.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div>
				<Label for="invite-email" class="mb-2 block">Email address</Label>
				<Input id="invite-email" type="email" bind:value={inviteEmail} placeholder="user@example.com" />
			</div>

			{#if inviteError}
				<Alert.Root variant="destructive">
					<Alert.Description>{inviteError}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer class="gap-2">
			<Button
				variant="ghost"
				onclick={() => {
					showInviteModal = false;
					inviteEmail = '';
					inviteError = '';
				}}
			>
				Cancel
			</Button>
			<Button onclick={inviteMember} disabled={!inviteEmail.trim() || isInviting}>
				{#if isInviting}
					<Loader2 size={14} class="animate-spin" />
				{/if}
				Invite
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showWipeModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-destructive/10 p-2">
					<AlertTriangle class="h-5 w-5 text-destructive" />
				</div>
				<Dialog.Title>Wipe All Data</Dialog.Title>
			</div>
		</Dialog.Header>

		<p class="mb-4 text-sm text-muted-foreground">
			Are you sure you want to wipe all analytics data for <span class="font-medium text-foreground">{domain}</span>? This action cannot be undone.
		</p>

		<div class="mb-4">
			<Label for="wipe-confirm-input" class="mb-2 block">
				Type <span class="text-destructive">WIPE</span> to confirm
			</Label>
			<Input id="wipe-confirm-input" bind:value={wipeConfirmText} placeholder="WIPE" class="border-destructive focus-visible:ring-destructive" />
		</div>

		{#if wipeError}
			<Alert.Root variant="destructive" class="mb-4">
				<Alert.Description>{wipeError}</Alert.Description>
			</Alert.Root>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button
				variant="ghost"
				onclick={() => {
					showWipeModal = false;
					wipeConfirmText = '';
					wipeError = '';
				}}
			>
				Cancel
			</Button>
			<Button variant="destructive" onclick={wipeData} disabled={wipeConfirmText !== 'WIPE' || isWiping}>
				{#if isWiping}
					<Loader2 size={14} class="animate-spin" />
				{/if}
				Wipe Data
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
