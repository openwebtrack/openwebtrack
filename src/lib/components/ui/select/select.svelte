<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		value?: string;
		type?: 'single' | 'multiple';
		children?: Snippet;
		[key: string]: any;
	}

	let { open = $bindable(false), value = $bindable(''), type = 'single', children, ...restProps }: Props = $props();
</script>

<SelectPrimitive.Root bind:open bind:value={value as never} type={type as 'single'} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</SelectPrimitive.Root>
