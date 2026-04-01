<script lang="ts">
	import './layout.css';
	import Header from '$lib/components/Header.svelte';
	import favicon from '$lib/assets/favicon.png';
	import { page } from '$app/stores';

	let { children } = $props();

	const isWidget = $derived($page.url.pathname.startsWith('/widget/'));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if $page.url.pathname !== '/demo' && !isWidget}
	<Header />
{/if}

{@render children()}
