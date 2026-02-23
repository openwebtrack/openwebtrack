<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children,
		...rest
	} = $props<{
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}>();
</script>

<Card.Root class={className} {...rest}>
	{@render children?.()}
</Card.Root>
