<script lang="ts">
	import ChangelogButton from '$lib/components/dashboard/ChangelogButton.svelte';

	let { children } = $props();
</script>

{@render children()}

<ChangelogButton />
