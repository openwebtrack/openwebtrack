<script lang="ts" module>
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils/helpers.js';
	import { type VariantProps, tv } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: "cursor-pointer focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 active:translate-y-px active:scale-[0.98]",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.15)] hover:bg-primary/90',
				destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
				outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground border border-transparent hover:bg-secondary/80',
				ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-9 px-4 py-2 has-[>svg]:px-3',
				sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5 text-xs',
				lg: 'h-10 px-6 has-[>svg]:px-4',
				icon: 'size-9',
				'icon-sm': 'size-8',
				'icon-lg': 'size-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let { class: className, variant = 'default', size = 'default', ref = $bindable(null), href = undefined, type = 'button', disabled, children, ...restProps }: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button bind:this={ref} data-slot="button" class={cn(buttonVariants({ variant, size }), className)} {type} {disabled} {...restProps}>
		{@render children?.()}
	</button>
{/if}
