<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Header />
{@render children()}
