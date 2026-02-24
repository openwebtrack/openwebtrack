<script lang="ts">
	import './layout.css';
	import VersionWarning from '$lib/components/VersionWarning.svelte';
	import Header from '$lib/components/Header.svelte';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Header />

<VersionWarning />

{@render children()}
