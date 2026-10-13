<script lang="ts">
	import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-svelte';
	import { TIMEZONES } from '$lib/utils/constants';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import axios from 'axios';
	import { track } from '$lib/analytics';

	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import ImportDataCard from '$lib/components/ImportDataCard.svelte';

	const steps = ['Add site', 'Import data', 'Install script'];

	let createdWebsite = $state<{ id: string; domain: string } | null>(null);
	let copySuccess = $state(false);
	let isLoading = $state(false);
	let timezone = $state('');
	let domain = $state('');
	let error = $state('');
	let step = $state(1);

	let importCard = $state<ImportDataCard>();
	let importReady = $state(false);
	let importBusy = $state(false);
	let importMessage = $state('');

	// One button for the import step: imports first when something is selected, then moves on.
	// A failed import keeps the user here, with the error shown in the card.
	const importAndContinue = async () => {
		if (importReady && importCard) {
			const message = await importCard.submit();
			if (message === null) return;
			importMessage = message;
		}
		step = 3;
	};

	onMount(() => {
		try {
			const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (detected && TIMEZONES.includes(detected as (typeof TIMEZONES)[number])) {
				timezone = detected;
			} else if (detected) {
				timezone = detected;
			} else {
				timezone = 'UTC';
			}
		} catch {
			timezone = 'UTC';
		}
	});

	const nextStep = async () => {
		if (step === 1) {
			if (!domain.trim()) {
				error = 'Please enter a domain';
				return;
			}

			isLoading = true;
			error = '';

			try {
				const response = await axios.post('/api/websites', { domain, timezone });
				createdWebsite = response.data;
				track('website_created');
				step++;
			} catch (e) {
				const axiosErr = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
				const serverMsg = axiosErr.response?.data?.error ?? axiosErr.response?.data?.message;
				if (axiosErr.response?.status === 402) {
					error = serverMsg ?? 'Subscription required. Please subscribe to add websites.';
				} else if (axiosErr.response?.status === 409) {
					error = serverMsg ?? 'Domain already registered.';
				} else {
					error = serverMsg ?? axiosErr.message ?? 'Failed to create website';
				}
				// If subscription required, offer upgrade link via error text
			} finally {
				isLoading = false;
			}
		} else if (step < 3) {
			step++;
		}
	};

	let cookieless = $state(false);
	let scriptCode = $derived(
		`<script defer data-website-id="${createdWebsite?.id}" data-domain="${domain}" src="${browser ? window.location.origin : ''}/${cookieless ? 'script.cookieless.js' : 'script.js'}"><\/script>`
	);

	const handleCopy = () => {
		if (!createdWebsite) return;
		navigator.clipboard.writeText(scriptCode);
		copySuccess = true;
		setTimeout(() => (copySuccess = false), 2000);
	};
</script>

<div class="relative min-h-screen bg-background">
	<main class="mx-auto max-w-2xl px-4 pt-10 pb-20">
		<Button href="/dashboard" variant="outline" class="mb-8 gap-2">
			<ArrowLeft class="h-4 w-4" />
			Dashboard
		</Button>

		<div class="mb-12 ml-1 flex flex-wrap items-center gap-x-8 gap-y-3">
			{#each steps as label, i}
				<div class="flex items-center gap-2">
					<div
						class={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${step >= i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
					>
						{#if step > i + 1}
							<Check class="h-3 w-3" />
						{/if}
					</div>
					<span class={`text-sm font-medium ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
				</div>
			{/each}
		</div>

		{#if step === 1}
			<div in:fade={{ duration: 200 }}>
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Add a new website</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-6">
						<div class="space-y-2">
							<Label for="domain-input">Domain</Label>
							<div class="relative">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
									<span class="text-sm text-muted-foreground">https://</span>
								</div>
								<Input id="domain-input" type="text" bind:value={domain} placeholder="yourdomain.com" class="pl-16" />
							</div>
						</div>

						<div class="space-y-2">
							<Label for="timezone-select">Timezone</Label>
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
							<p class="text-xs text-muted-foreground">This defines what "today" means in your reports</p>
						</div>

						{#if error}
							<Alert.Root variant="destructive">
								<Alert.Description class="gap-2">
									<span>{error}</span>
									{#if error.toLowerCase().includes('subscription') || error.toLowerCase().includes('limit reached')}
										<Button href="/account?tab=billing" size="sm" variant="outline" class="w-fit">View plans</Button>
									{/if}
								</Alert.Description>
							</Alert.Root>
						{/if}

						<Button onclick={nextStep} disabled={isLoading} class="w-full">
							{#if isLoading}
								<Loader2 class="h-4 w-4 animate-spin" />
								Creating...
							{:else}
								Add website
							{/if}
						</Button>
					</Card.Content>
				</Card.Root>
			</div>
		{:else if step === 2 && createdWebsite}
			<div class="space-y-4" in:fade={{ duration: 200 }}>
				<p class="text-sm text-muted-foreground">
					Moving from another analytics tool? Bring your history with you. You can also do this later from the website's <strong>Settings &gt; Data</strong>.
				</p>
				<ImportDataCard bind:this={importCard} bind:ready={importReady} bind:busy={importBusy} websiteId={createdWebsite.id} showSubmit={false} />
				<Button variant={importReady ? 'default' : 'outline'} class="w-full gap-2" onclick={importAndContinue} disabled={importBusy}>
					{#if importBusy}
						<Loader2 class="h-4 w-4 animate-spin" />
						Importing...
					{:else}
						{importReady ? 'Import and continue to install script' : 'Skip and continue to install script'}
						<ArrowLeft class="h-4 w-4 rotate-180" />
					{/if}
				</Button>
			</div>
		{:else if step === 3}
			<div class="space-y-4" in:fade={{ duration: 200 }}>
				{#if importMessage}
					<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
						<Check size={16} />
						<Alert.Description>{importMessage}</Alert.Description>
					</Alert.Root>
				{/if}
				<Card.Root>
					<Card.Content>
						<p class="mb-3 text-sm text-muted-foreground">
							Paste the snippet in the <code class="rounded bg-primary/10 px-1 py-0.5 text-xs text-primary">&lt;head&gt;</code>
							of your site.
						</p>

						<div class="group relative">
							<div class="absolute top-1/2 right-3 -translate-y-1/2">
								<Button onclick={handleCopy} variant="secondary" size="icon-sm">
									{#if copySuccess}
										<Check class="h-3.5 w-3.5" />
									{:else}
										<Copy class="h-3.5 w-3.5" />
									{/if}
								</Button>
							</div>
							<pre class="w-full overflow-x-auto rounded-lg border bg-muted p-4 text-sm [&::-webkit-scrollbar]:hidden">{scriptCode}</pre>
						</div>
						<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm select-none">
							<input type="checkbox" bind:checked={cookieless} class="h-4 w-4 cursor-pointer accent-primary" />
							<span class="flex items-center gap-x-2">
								<svg
									class="size-7"
									xmlns="http://www.w3.org/2000/svg"
									shape-rendering="geometricPrecision"
									text-rendering="geometricPrecision"
									image-rendering="optimizeQuality"
									fill-rule="evenodd"
									clip-rule="evenodd"
									viewBox="0 0 512 356.18"
									><path
										fill="#039"
										fill-rule="nonzero"
										d="M28.137 0H483.86C499.337 0 512 12.663 512 28.14v299.9c0 15.477-12.663 28.14-28.14 28.14H28.137C12.663 356.18 0 343.517 0 328.04V28.14C0 12.663 12.663 0 28.137 0z"
									/><path
										fill="#FC0"
										d="M237.179 53.246h14.378L256 39.572l4.443 13.674h14.378l-11.633 8.451 4.444 13.673L256 66.919l-11.632 8.451 4.444-13.673-11.633-8.451zm0 237.458h14.378L256 277.03l4.443 13.674h14.378l-11.633 8.451 4.444 13.673L256 304.377l-11.632 8.451 4.444-13.673-11.633-8.451zM118.45 171.975h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.443 13.673-11.631-8.451-11.632 8.451 4.444-13.673-11.633-8.451zm59.363-102.796h14.377l4.443-13.674 4.443 13.674h14.378l-11.632 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm-43.429 43.429h14.378l4.442-13.673 4.444 13.673h14.377l-11.632 8.451 4.443 13.674-11.632-8.451-11.631 8.451 4.443-13.674-11.632-8.451zm-.032 118.737h14.377l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm43.471 43.46h14.378l4.443-13.674 4.443 13.674h14.378l-11.632 8.451 4.443 13.674-11.632-8.451-11.631 8.451 4.443-13.674-11.633-8.451zm178.085-102.83h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.444 13.673-11.632-8.451-11.631 8.451 4.443-13.673-11.633-8.451zM296.546 69.179h14.378l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.632-8.451zm43.429 43.429h14.377l4.444-13.673 4.442 13.673h14.378l-11.632 8.451 4.443 13.674-11.631-8.451-11.632 8.451 4.443-13.674-11.632-8.451zm.033 118.737h14.377l4.443-13.674 4.443 13.674h14.377l-11.631 8.451 4.443 13.674-11.632-8.451-11.632 8.451 4.443-13.674-11.631-8.451zm-43.473 43.46h14.378l4.443-13.674 4.443 13.674h14.378l-11.633 8.451 4.443 13.674-11.631-8.451-11.632 8.451 4.443-13.674-11.632-8.451z"
									/></svg
								>
								Cookieless mode <span class="text-xs text-muted-foreground">(GDPR-friendly, no cookies)</span></span
							>
						</label>

						<Button class="mt-3 w-full gap-2" onclick={() => goto(`/dashboard/${createdWebsite?.id || ''}`)}>
							Go to website <ArrowLeft class="h-4 w-4 rotate-180" />
						</Button>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</main>
</div>
