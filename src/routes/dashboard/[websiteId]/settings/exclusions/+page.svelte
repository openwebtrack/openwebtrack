<script lang="ts">
	import { Filter, Check, Loader2, X } from 'lucide-svelte';
	import { COUNTRY_OPTIONS } from '$lib/utils/constants';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let originalExcludedIps = $state<string[]>((website.excludedIps as string[]) || []);
	let originalExcludedPaths = $state<string[]>((website.excludedPaths as string[]) || []);
	let originalExcludedCountries = $state<string[]>((website.excludedCountries as string[]) || []);
	let excludedIps = $state<string[]>((website.excludedIps as string[]) || []);
	let excludedPaths = $state<string[]>((website.excludedPaths as string[]) || []);
	let excludedCountries = $state<string[]>((website.excludedCountries as string[]) || []);

	let saveSuccess = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	let newIp = $state('');
	let newPath = $state('');
	let newCountry = $state('');
	let ipError = $state('');
	let pathError = $state('');

	const hasChanges = $derived(
		JSON.stringify(excludedIps) !== JSON.stringify(originalExcludedIps) ||
			JSON.stringify(excludedPaths) !== JSON.stringify(originalExcludedPaths) ||
			JSON.stringify(excludedCountries) !== JSON.stringify(originalExcludedCountries)
	);

	$effect(() => {
		const w = website;
		if (!w?.id) return;
		originalExcludedIps = (w.excludedIps as string[]) || [];
		originalExcludedPaths = (w.excludedPaths as string[]) || [];
		originalExcludedCountries = (w.excludedCountries as string[]) || [];
		excludedIps = (w.excludedIps as string[]) || [];
		excludedPaths = (w.excludedPaths as string[]) || [];
		excludedCountries = (w.excludedCountries as string[]) || [];
	});

	const isValidIp = (ip: string): boolean => {
		const trimmed = ip.trim();
		if (!trimmed) return false;

		if (trimmed.includes('/')) {
			const [ipPart, maskPart] = trimmed.split('/');
			const mask = parseInt(maskPart, 10);
			if (isNaN(mask) || mask < 0 || mask > 32) return false;
			return isValidIpBase(ipPart, true);
		}

		return isValidIpBase(trimmed, true);
	};

	const isValidIpBase = (ip: string, allowWildcards: boolean): boolean => {
		const parts = ip.split('.');
		if (parts.length !== 4) return false;

		for (const part of parts) {
			if (allowWildcards && part === '*') continue;
			if (part.includes('*')) return false;
			const num = parseInt(part, 10);
			if (isNaN(num) || num < 0 || num > 255) return false;
			if (part !== String(num)) return false;
		}

		return true;
	};

	const isValidPath = (path: string): boolean => {
		const trimmed = path.trim();
		if (!trimmed) return false;
		if (!trimmed.startsWith('/')) return false;
		if (trimmed.length > 500) return false;
		if (/[<>\"'\\]/.test(trimmed)) return false;
		return true;
	};

	const addIp = () => {
		ipError = '';
		const trimmed = newIp.trim();
		if (!trimmed) return;
		if (!isValidIp(trimmed)) {
			ipError = 'Invalid IP format. Use: 192.168.1.1, 192.168.*.*, or 10.0.0.0/24';
			return;
		}
		if (excludedIps.includes(trimmed)) {
			ipError = 'This IP is already in the list';
			return;
		}
		excludedIps = [...excludedIps, trimmed];
		newIp = '';
	};

	const addPath = () => {
		pathError = '';
		const trimmed = newPath.trim();
		if (!trimmed) return;
		if (!isValidPath(trimmed)) {
			pathError = 'Invalid path. Must start with / and contain no special characters like < > " \' \\';
			return;
		}
		if (excludedPaths.includes(trimmed)) {
			pathError = 'This path is already in the list';
			return;
		}
		excludedPaths = [...excludedPaths, trimmed];
		newPath = '';
	};

	const saveSettings = async () => {
		isSaving = true;
		saveError = '';
		saveSuccess = false;

		try {
			await axios.put(`/api/websites/${data.website.id}`, {
				excludedIps,
				excludedPaths,
				excludedCountries
			});
			originalExcludedIps = [...excludedIps];
			originalExcludedPaths = [...excludedPaths];
			originalExcludedCountries = [...excludedCountries];
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (e: any) {
			saveError = (e as any).response?.data?.message || e instanceof Error ? e.message : 'Failed to update settings';
		} finally {
			isSaving = false;
		}
	};
</script>

<svelte:head>
	<title>Settings - {website.domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Excluded IPs</Card.Title>
		<Card.Description>Exclude tracking from specific IP addresses.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="mb-4 flex gap-2">
			<div class="flex-1">
				<Input
					type="text"
					bind:value={newIp}
					placeholder="e.g., 192.168.1.1 or 10.0.*.*"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addIp();
						}
					}}
				/>
				{#if ipError}
					<p class="mt-1 text-sm text-destructive">{ipError}</p>
				{/if}
			</div>
			<Button onclick={addIp}>Add</Button>
		</div>
		{#if excludedIps.length > 0}
			<div class="space-y-2">
				{#each excludedIps as ip, index}
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
						<code class="text-sm">{ip}</code>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => {
								excludedIps = excludedIps.filter((_, i) => i !== index);
							}}
							class="text-muted-foreground hover:text-destructive"
						>
							<X size={14} />
						</Button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">No IPs excluded.</p>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Excluded Paths</Card.Title>
		<Card.Description>Exclude tracking from specific URL paths.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="mb-4 flex gap-2">
			<div class="flex-1">
				<Input
					type="text"
					bind:value={newPath}
					placeholder="e.g., /admin or /api/*"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addPath();
						}
					}}
				/>
				{#if pathError}
					<p class="mt-1 text-sm text-destructive">{pathError}</p>
				{/if}
			</div>
			<Button onclick={addPath}>Add</Button>
		</div>
		{#if excludedPaths.length > 0}
			<div class="space-y-2">
				{#each excludedPaths as path, index}
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
						<code class="text-sm">{path}</code>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => {
								excludedPaths = excludedPaths.filter((_, i) => i !== index);
							}}
							class="text-muted-foreground hover:text-destructive"
						>
							<X size={14} />
						</Button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">No paths excluded.</p>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Excluded Countries</Card.Title>
		<Card.Description>Exclude tracking from visitors in specific countries.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="mb-4">
			<Select.Root bind:value={newCountry} type="single">
				<Select.Trigger class="w-full">
					{newCountry || 'Select a country...'}
				</Select.Trigger>
				<Select.Content>
					{#each COUNTRY_OPTIONS as country}
						<Select.Item value={country} label={country} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="mb-4">
			<Button
				onclick={() => {
					if (newCountry && !excludedCountries.includes(newCountry)) {
						excludedCountries = [...excludedCountries, newCountry];
						newCountry = '';
					}
				}}
				disabled={!newCountry || excludedCountries.includes(newCountry)}
			>
				Add Country
			</Button>
		</div>
		{#if excludedCountries.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each excludedCountries as country, index}
					<div class="flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1">
						<span class="text-sm">{country}</span>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => {
								excludedCountries = excludedCountries.filter((_, i) => i !== index);
							}}
							class="h-4 w-4 text-muted-foreground hover:text-destructive"
						>
							<X size={12} />
						</Button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">No countries excluded.</p>
		{/if}
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
