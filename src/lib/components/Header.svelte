<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import authClient from '$lib/auth-client';
	import Logo from '$lib/components/Logo.svelte';

	const session = authClient.useSession();
</script>

<header class="h-14 w-full">
	<div class="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
		<a href="/dashboard" class="flex items-center gap-2.5">
			<Logo class="size-7 text-primary" />
			<span class="text-sm font-medium tracking-tight">OpenWebTrack</span>
		</a>

		{#if $session.data}
			<a class="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-accent" href="/account">
				<img src={`https://api.dicebear.com/9.x/glass/svg?seed=owt-${$session.data.user.name}`} alt="Avatar" class="size-7 rounded-full bg-secondary" />
				<span class="text-xs font-medium text-muted-foreground">{$session.data.user.name}</span>
			</a>
		{:else}
			<Button variant="ghost" size="sm" href="/auth">Sign in</Button>
		{/if}
	</div>
</header>
