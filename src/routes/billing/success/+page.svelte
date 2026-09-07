<script lang="ts">
	import { page } from '$app/state';
	import { Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	const checkoutId = $derived(page.url.searchParams.get('checkout_id') ?? '');
</script>

<svelte:head>
	<title>Billing — Success</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-8">
	<Card.Root class="w-full max-w-md text-center">
		<Card.Header class="items-center">
			<div class="mb-2 flex size-12 items-center justify-center rounded-full bg-green-500/15 text-green-600">
				<Check size={24} />
			</div>
			<Card.Title>Checkout complete</Card.Title>
			<Card.Description>
				{#if checkoutId}
					Checkout <span class="font-mono text-xs">{checkoutId}</span> is being processed. Your subscription will be active shortly.
				{:else}
					Your subscription is being processed. You’ll see it in Account → Billing shortly.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex justify-center gap-2">
			<Button href="/account?tab=billing">Go to Billing</Button>
			<Button variant="outline" href="/dashboard">Dashboard</Button>
		</Card.Content>
	</Card.Root>
</div>
