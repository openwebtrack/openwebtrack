<script lang="ts">
	import { Settings, Bell, Filter, Users, Database } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { page } from '$app/state';

	let { data, children } = $props();

	let website = $derived(data.website);

	const sidebarItems = [
		{ id: 'general', label: 'General', icon: Settings, href: `/dashboard/${website.id}/settings` },
		{ id: 'notifications', label: 'Notifications', icon: Bell, href: `/dashboard/${website.id}/settings/notifications` },
		{ id: 'exclusions', label: 'Exclusions', icon: Filter, href: `/dashboard/${website.id}/settings/exclusions` },
		{ id: 'team', label: 'Team', icon: Users, href: `/dashboard/${website.id}/settings/team` },
		{ id: 'data', label: 'Data', icon: Database, href: `/dashboard/${website.id}/settings/data` }
	];

	let currentPath = $derived(page.url.pathname);

	const isActive = (href: string) => {
		if (href.endsWith('/settings')) return currentPath === href;
		return currentPath.startsWith(href);
	};
</script>

<div class="min-h-screen p-8">
	<div class="mx-auto max-w-6xl">
		<div class="mb-8">
			<Button variant="ghost" href="/dashboard/{website.id}" class="mb-4 gap-2 text-muted-foreground">
				<span>&larr;</span>
				Back
			</Button>
			<h1 class="text-2xl font-bold">Settings for {website.domain}</h1>
		</div>

		<div class="flex flex-col gap-8 md:flex-row">
			<div class="w-full shrink-0 md:w-64">
				<nav class="space-y-1">
					{#each sidebarItems as item}
						<Button variant={isActive(item.href) ? 'secondary' : 'ghost'} href={item.href} class="w-full justify-start">
							<item.icon size={18} class="mr-3" />
							{item.label}
						</Button>
					{/each}
				</nav>
			</div>

			<div class="min-w-0 flex-1 space-y-8 pb-20">
				{@render children()}
			</div>
		</div>
	</div>
</div>
