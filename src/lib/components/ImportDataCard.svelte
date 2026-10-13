<script lang="ts">
	import { Upload, Loader2, Check } from 'lucide-svelte';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import Logo from '$lib/components/Logo.svelte';
	import { BACKUP_FORMAT, BACKUP_VERSION, BACKUP_SECTIONS, BACKUP_MAX_ROWS_PER_CHUNK } from '$lib/backup';

	let { websiteId, class: className = '' }: { websiteId: string; class?: string } = $props();

	let isImporting = $state(false);
	let importError = $state('');
	let importSuccess = $state('');
	let importFile = $state<File | null>(null);
	let selectedPlatform = $state('openwebtrack');
	let importFiles = $state<File[]>([]);
	let datafastApiKey = $state('');
	let importProgress = $state<number | null>(null);

	const platforms = [
		{ id: 'openwebtrack', label: 'OpenWebTrack', description: 'Import a backup exported from another OpenWebTrack instance', icon: null },
		{ id: 'umami', label: 'Umami', description: 'Import website_event.csv from Umami export', icon: 'https://icons.duckduckgo.com/ip3/umami.is.ico' },
		{ id: 'plausible', label: 'Plausible', description: 'Import all CSV files from Plausible export (visitors, pages, browsers, etc.)', icon: 'https://icons.duckduckgo.com/ip3/plausible.io.ico' },
		{ id: 'datafast', label: 'DataFast', description: 'Import data from DataFast API', icon: 'https://icons.duckduckgo.com/ip3/datafa.st.ico' }
	];

	// Switching source clears the previous selection so one tab's file is never sent by another.
	const resetImport = () => {
		importFile = null;
		importFiles = [];
		importError = '';
		importSuccess = '';
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
		if (selectedPlatform === 'datafast') {
			if (!datafastApiKey.trim()) {
				importError = 'Please enter your DataFast API key';
				return;
			}

			isImporting = true;
			importError = '';
			importSuccess = '';

			try {
				const formData = new FormData();
				formData.append('platform', 'datafast');
				formData.append('apiKey', datafastApiKey.trim());

				const res = await axios.post(`/api/websites/${websiteId}/import`, formData, {
					headers: { 'Content-Type': 'multipart/form-data' }
				});

				importSuccess = res.data.message;
				datafastApiKey = '';
			} catch (e: any) {
				importError = e.response?.data?.message || 'Failed to import data from DataFast. Please check your API key.';
				console.error('DataFast import error:', e);
			} finally {
				isImporting = false;
			}
			return;
		} else if (selectedPlatform === 'plausible' || selectedPlatform === 'ga') {
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
			const res = await axios.post(`/api/websites/${websiteId}/import`, formData, {
				headers: { 'Content-Type': 'multipart/form-data' }
			});

			importSuccess = res.data.message;
			importFile = null;
			importFiles = [];
			datafastApiKey = '';
			const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
			if (fileInput) fileInput.value = '';
		} catch (e: any) {
			importError = e.response?.data?.message || 'Failed to import data. Please check your file format.';
			console.error('Import error:', e);
		} finally {
			isImporting = false;
		}
	};

	// Keeps each request well under the server's default 512 KB body limit.
	const BACKUP_CHUNK_BYTES = 256 * 1024;

	const importBackup = async () => {
		if (!importFile) return;

		isImporting = true;
		importError = '';
		importSuccess = '';
		importProgress = 0;

		try {
			let backup: Record<string, any>;
			try {
				backup = JSON.parse(await importFile.text());
			} catch {
				throw new Error('This file is not valid JSON.');
			}
			if (backup?.format !== BACKUP_FORMAT) {
				throw new Error('This file is not an OpenWebTrack backup.');
			}
			if (backup.version > BACKUP_VERSION) {
				throw new Error('This backup was made by a newer OpenWebTrack version. Update this instance and try again.');
			}

			const endpoint = `/api/websites/${websiteId}/import/openwebtrack`;
			const totals: Record<string, number> = { skipped: 0 };
			const send = async (body: Record<string, unknown>) => {
				const res = await axios.post(endpoint, body);
				for (const [section, count] of Object.entries(res.data.imported as Record<string, number>)) {
					totals[section] = (totals[section] ?? 0) + count;
				}
				totals.skipped += res.data.skipped;
			};

			if (backup.website) await send({ website: backup.website });

			const totalRows = BACKUP_SECTIONS.reduce((sum, section) => sum + (backup[section]?.length ?? 0), 0);
			const encoder = new TextEncoder();
			let sentRows = 0;

			// Sections go in dependency order so parents always exist before their children arrive.
			for (const section of BACKUP_SECTIONS) {
				const rows: unknown[] = backup[section] ?? [];
				let batch: unknown[] = [];
				let batchBytes = 0;

				const flush = async () => {
					if (batch.length === 0) return;
					await send({ [section]: batch });
					sentRows += batch.length;
					importProgress = totalRows ? sentRows / totalRows : 1;
					batch = [];
					batchBytes = 0;
				};

				for (const row of rows) {
					const rowBytes = encoder.encode(JSON.stringify(row)).length + 1;
					if (batch.length >= BACKUP_MAX_ROWS_PER_CHUNK || (batch.length > 0 && batchBytes + rowBytes > BACKUP_CHUNK_BYTES)) {
						await flush();
					}
					batch.push(row);
					batchBytes += rowBytes;
				}
				await flush();
			}

			const parts = [
				`${totals.visitors ?? 0} visitors`,
				`${totals.sessions ?? 0} sessions`,
				`${totals.pageviews ?? 0} pageviews`,
				`${totals.events ?? 0} events`,
				`${totals.payments ?? 0} payments`,
				`${totals.funnels ?? 0} funnels`
			];
			importSuccess = `Imported ${parts.join(', ')}.` + (totals.skipped ? ` Skipped ${totals.skipped} rows with missing references.` : '');
			importFile = null;
			const fileInput = document.getElementById('import-file-input-openwebtrack') as HTMLInputElement;
			if (fileInput) fileInput.value = '';
		} catch (e: any) {
			importError = e.response ? `${e.response.data?.message || 'Import failed.'} Rows already imported are kept — run the import again to resume.` : e.message || 'Failed to import backup.';
			console.error('Backup import error:', e);
		} finally {
			isImporting = false;
			importProgress = null;
		}
	};
</script>

<Card.Root class={className}>
	<Card.Header>
		<Card.Title>Import Data</Card.Title>
		<Card.Description>Import analytics data from another OpenWebTrack instance or other analytics platforms.</Card.Description>
	</Card.Header>
	<Card.Content>
		<Tabs.Root bind:value={selectedPlatform} onValueChange={resetImport} class="w-full">
			<Tabs.List class="mb-4 max-w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden">
				{#each platforms as platform}
					<Tabs.Trigger value={platform.id} class="shrink-0 gap-2">
						{#if platform.icon}
							<img src={platform.icon} alt={platform.label} class="h-4 w-4" />
						{:else}
							<Logo class="h-4 w-4" />
						{/if}
						{platform.label}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>

			<Tabs.Content value="openwebtrack">
				<div class="mb-4 rounded-lg border bg-muted/50 p-4">
					<h4 class="mb-2 font-medium">OpenWebTrack Import Instructions</h4>
					<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
						<li>On the other OpenWebTrack instance, open this website's <strong>Settings &gt; Data</strong></li>
						<li>Click <strong>Download Backup</strong> under Export Data</li>
						<li>Upload the downloaded <code class="rounded bg-muted px-1 py-0.5">.json</code> file below</li>
					</ol>
					<p class="mt-2 text-sm text-muted-foreground">
						Visitors, sessions, pageviews, events, payments, funnels and exclusion rules are imported. Importing the same backup again skips rows that are already here.
					</p>
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
					<Input id="import-file-input-openwebtrack" type="file" accept=".json,application/json" onchange={handleFileSelect} />
					{#if importProgress !== null}
						<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
							<div class="h-full bg-primary transition-all" style="width: {Math.round(importProgress * 100)}%"></div>
						</div>
					{/if}
					<Button onclick={importBackup} disabled={!importFile || isImporting}>
						{#if isImporting}
							<Loader2 size={14} class="mr-2 animate-spin" />
							Importing{importProgress !== null ? ` ${Math.round(importProgress * 100)}%` : ''}
						{:else}
							<Upload size={14} class="mr-2" />
							Import from OpenWebTrack
						{/if}
					</Button>
				</div>
			</Tabs.Content>

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

			<Tabs.Content value="datafast">
				<div class="mb-4 rounded-lg border bg-muted/50 p-4">
					<h4 class="mb-2 font-medium">DataFast Import Instructions</h4>
					<ol class="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
						<li>
							Go to <a href="https://datafa.st/dashboard" class="text-primary" target="_blank" rel="noopener">DataFast Dashboard</a>
						</li>
						<li>Select your website and go to <strong>Settings &gt; API</strong></li>
						<li>Create a new API key if you haven't already</li>
						<li>Copy the API key and paste it below</li>
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
					<div class="flex flex-col gap-2">
						<Label for="datafast-api-key">DataFast API Key</Label>
						<Input
							id="datafast-api-key"
							type="password"
							placeholder="Enter your DataFast API key"
							bind:value={datafastApiKey}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleImport();
							}}
						/>
					</div>
					<Button onclick={handleImport} disabled={!datafastApiKey.trim() || isImporting}>
						{#if isImporting}
							<Loader2 size={14} class="mr-2 animate-spin" />
						{:else}
							<Upload size={14} class="mr-2" />
						{/if}
						Import from DataFast
					</Button>
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</Card.Content>
</Card.Root>
