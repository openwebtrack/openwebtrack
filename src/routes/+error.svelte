<script lang="ts">
	import { ArrowLeft, AlertTriangle, Home } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { page } from '$app/state';

	let status = $derived(page.status);
	let message = $derived(page.error?.message || 'An error occurred');
</script>

<svelte:head>
	<title>{status} - Error</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="px-4 text-center">
		<div class="mb-6 flex justify-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<AlertTriangle class="h-8 w-8 text-muted-foreground" />
			</div>
		</div>

		<h1 class="mb-4 text-6xl font-bold">{status}</h1>
		<p class="mx-auto mb-8 max-w-md text-lg text-muted-foreground">{message}</p>

		<div class="flex items-center justify-center gap-4">
			<Button href="/dashboard" variant="secondary" class="gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back to Dashboard
			</Button>
			<Button href="/" class="gap-2">
				<Home class="h-4 w-4" />
				Go Home
			</Button>
		</div>
	</div>
</div>
