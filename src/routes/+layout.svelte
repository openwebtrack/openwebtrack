<script lang="ts">
	import './layout.css';
	import Header from '$lib/components/Header.svelte';
	import favicon from '$lib/assets/favicon.png';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const isWidget = $derived($page.url.pathname.startsWith('/widget/'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if !data.enableIndexing}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

{#if $page.url.pathname !== '/demo' && !isWidget}
	<Header />
{/if}

{@render children()}
