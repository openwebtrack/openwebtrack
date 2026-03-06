<script lang="ts">
	import authClient from '$lib/auth-client';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Logo from '$lib/components/Logo.svelte';

	const session = authClient.useSession();
</script>

<header class="py-4 text-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between">
			<a href="/dashboard" class="flex items-center gap-3">
				<Logo class="h-8 w-8 text-primary" />
				<span class="text-lg font-bold tracking-tight">OpenWebTrack</span>
			</a>

			{#if $session.data}
				<div class="flex items-center gap-3">
					<a class="flex items-center gap-2 transition-opacity hover:opacity-80" href="/account">
						<Avatar.Root class="h-6 w-6">
							<Avatar.Image src={$session.data.user.image || undefined} alt={$session.data.user.name || 'User'} />
							<Avatar.Fallback class="bg-zinc-700 text-xs font-medium text-zinc-300">
								{$session.data.user.name?.charAt(0) || '?'}
							</Avatar.Fallback>
						</Avatar.Root>
						<span class="text-sm font-medium text-zinc-400">{$session.data.user.name}</span>
					</a>
				</div>
			{:else}
				<Button variant="ghost" href="/auth" class="text-sm text-zinc-400 hover:text-white">Sign In</Button>
			{/if}
		</div>
	</div>
</header>
