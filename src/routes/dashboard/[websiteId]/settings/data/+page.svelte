<script lang="ts">
	import { Database, Download, Upload, Trash2, Loader2, AlertTriangle, Check } from 'lucide-svelte';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

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
			link.download = `${website.domain.replace(/[^a-z0-9]/gi, '_')}_analytics_${new Date().toISOString().split('T')[0]}.csv`;
			link.click();
			setTimeout(() => {
				URL.revokeObjectURL(link.href);
				link.remove();
			}, 1000);
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
</script>

<svelte:head>
	<title>Settings - {website.domain}</title>
</svelte:head>

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
		<p class="mb-4 text-sm text-muted-foreground">This will delete all pageviews, sessions, visitors, and events. The website itself will remain, but all historical data will be lost.</p>
		<Button variant="destructive" onclick={() => (showWipeModal = true)}>
			<Trash2 size={14} class="mr-2" />
			Wipe All Data
		</Button>
	</Card.Content>
</Card.Root>

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
			Are you sure you want to wipe all analytics data for <span class="font-medium text-foreground">{website.domain}</span>? This action cannot be undone.
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
