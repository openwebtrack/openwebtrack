<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	let { class: className = '' }: { class?: string } = $props();
</script>

<Skeleton class={className} />
