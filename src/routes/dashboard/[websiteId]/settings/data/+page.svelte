<script lang="ts">
	import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-svelte';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import ImportDataCard from '$lib/components/ImportDataCard.svelte';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let isExporting = $state(false);
	let exportError = $state('');

	let showWipeModal = $state(false);
	let wipeConfirmText = $state('');
	let isWiping = $state(false);
	let wipeError = $state('');

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

<ImportDataCard websiteId={website.id} />

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Export Data</Card.Title>
		<Card.Description>Download your website analytics data.</Card.Description>
	</Card.Header>
	<Card.Content>
		<p class="mb-4 text-sm text-muted-foreground">
			<strong class="text-foreground">Backup</strong> is a complete JSON copy of this website's data that can be imported into any OpenWebTrack instance.
			<strong class="text-foreground">CSV</strong> can be opened in spreadsheet applications like Excel or Google Sheets.
		</p>
		{#if exportError}
			<Alert.Root variant="destructive" class="mb-4">
				<Alert.Description>{exportError}</Alert.Description>
			</Alert.Root>
		{/if}
		<div class="flex flex-wrap gap-2">
			<Button href="/api/websites/{data.website.id}/export?format=json" download>
				<Download size={14} class="mr-2" />
				Download Backup
			</Button>
			<Button variant="outline" onclick={exportToCsv} disabled={isExporting}>
				{#if isExporting}
					<Loader2 size={14} class="mr-2 animate-spin" />
				{:else}
					<Download size={14} class="mr-2" />
				{/if}
				Export to CSV
			</Button>
		</div>
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
