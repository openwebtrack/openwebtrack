<script lang="ts">
	import { Bell, Check, Loader2 } from 'lucide-svelte';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let trafficSpikeEnabled = $state(false);
	let trafficSpikeThreshold = $state(100);
	let trafficSpikeWindowSeconds = $state(60);
	let weeklySummaryEnabled = $state(false);
	let originalNotifications = $state({ trafficSpike: { enabled: false, threshold: 100, windowSeconds: 60 }, weeklySummary: { enabled: false } });

	let saveSuccess = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	const hasChanges = $derived(
		trafficSpikeEnabled !== originalNotifications.trafficSpike.enabled ||
			trafficSpikeThreshold !== originalNotifications.trafficSpike.threshold ||
			trafficSpikeWindowSeconds !== originalNotifications.trafficSpike.windowSeconds ||
			weeklySummaryEnabled !== originalNotifications.weeklySummary.enabled
	);

	let notificationsLoaded = $state(false);

	$effect(() => {
		if (!notificationsLoaded && data.website.notifications) {
			const notifs = data.website.notifications as { trafficSpike: { enabled: boolean; threshold: number; windowSeconds: number }; weeklySummary: { enabled: boolean } } | undefined;
			if (notifs) {
				trafficSpikeEnabled = notifs.trafficSpike?.enabled ?? false;
				trafficSpikeThreshold = notifs.trafficSpike?.threshold ?? 100;
				trafficSpikeWindowSeconds = notifs.trafficSpike?.windowSeconds ?? 60;
				weeklySummaryEnabled = notifs.weeklySummary?.enabled ?? false;
				originalNotifications = {
					trafficSpike: { enabled: trafficSpikeEnabled, threshold: trafficSpikeThreshold, windowSeconds: trafficSpikeWindowSeconds },
					weeklySummary: { enabled: weeklySummaryEnabled }
				};
				notificationsLoaded = true;
			}
		}
	});

	const saveSettings = async () => {
		isSaving = true;
		saveError = '';
		saveSuccess = false;

		try {
			await axios.put(`/api/websites/${data.website.id}`, {
				notifications: {
					trafficSpike: {
						enabled: trafficSpikeEnabled,
						threshold: trafficSpikeThreshold,
						windowSeconds: trafficSpikeWindowSeconds
					},
					weeklySummary: {
						enabled: weeklySummaryEnabled
					}
				}
			});
			originalNotifications = {
				trafficSpike: { enabled: trafficSpikeEnabled, threshold: trafficSpikeThreshold, windowSeconds: trafficSpikeWindowSeconds },
				weeklySummary: { enabled: weeklySummaryEnabled }
			};
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (e: any) {
			saveError = e.response?.data?.message || e instanceof Error ? e.message : 'Failed to update settings';
		} finally {
			isSaving = false;
		}
	};
</script>

<svelte:head>
	<title>Notifications - {website.domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Traffic Spike Alert</Card.Title>
		<Card.Description>Get notified when your website experiences a sudden increase in visitors.</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="font-medium">Enable traffic spike alerts</p>
				<p class="text-sm text-muted-foreground">Receive an email when visitor count exceeds threshold</p>
			</div>
			<Switch checked={trafficSpikeEnabled} onCheckedChange={(checked: boolean) => (trafficSpikeEnabled = checked)} />
		</div>
		{#if trafficSpikeEnabled}
			<div class="space-y-4 rounded-lg bg-muted/50 p-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="traffic-spike-threshold">Visitors threshold</Label>
						<Input id="traffic-spike-threshold" type="number" bind:value={trafficSpikeThreshold} min={10} max={10000} />
						<p class="text-xs text-muted-foreground">Alert when visitors exceed this number</p>
					</div>
					<div class="space-y-2">
						<Label for="traffic-spike-window">Time window (seconds)</Label>
						<Input id="traffic-spike-window" type="number" bind:value={trafficSpikeWindowSeconds} min={10} max={3600} />
						<p class="text-xs text-muted-foreground">Check visitors in this time window</p>
					</div>
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Weekly Summary</Card.Title>
		<Card.Description>Receive a weekly email with your website analytics summary. The schedule is configured in your deployment settings.</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="font-medium">Enable weekly summary</p>
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
