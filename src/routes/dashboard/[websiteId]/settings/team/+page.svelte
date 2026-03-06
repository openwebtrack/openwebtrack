<script lang="ts">
	import { Users, UserPlus, X, Loader2 } from 'lucide-svelte';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data }: { data: PageData } = $props();

	let website = $derived(data.website);

	let teamMembers = $state<{ id: string; userId: string; email: string; name: string | null; image: string | null; createdAt: Date }[]>([]);
	let isLoadingTeam = $state(true);
	let teamLoaded = $state(false);
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let isInviting = $state(false);
	let inviteError = $state('');
	let removeError = $state('');

	$effect(() => {
		if (!teamLoaded) {
			teamLoaded = true;
			loadTeamMembers();
		}
	});

	const loadTeamMembers = async () => {
		isLoadingTeam = true;
		try {
			const res = await axios.get(`/api/websites/${data.website.id}/team`);
			teamMembers = res.data;
		} catch (e) {
			console.error('Failed to load team members', e);
		} finally {
			isLoadingTeam = false;
		}
	};

	const inviteMember = async () => {
		if (!inviteEmail.trim()) return;

		isInviting = true;
		inviteError = '';

		try {
			const res = await axios.post(`/api/websites/${data.website.id}/team`, { email: inviteEmail });
			teamMembers = [...teamMembers, res.data];
			inviteEmail = '';
			showInviteModal = false;
		} catch (e: any) {
			inviteError = e.response?.data?.message || 'Failed to invite member';
		} finally {
			isInviting = false;
		}
	};

	const removeMember = async (memberId: string) => {
		removeError = '';
		try {
			await axios.delete(`/api/websites/${data.website.id}/team/${memberId}`);
			teamMembers = teamMembers.filter((m) => m.id !== memberId);
		} catch (e: any) {
			removeError = e.response?.data?.message || e instanceof Error ? e.message : 'Failed to remove member';
			console.error('Failed to remove member', e);
		}
	};
</script>

<svelte:head>
	<title>Settings - {website.domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title>Team Members</Card.Title>
				<Card.Description>Invite team members to view analytics for this website. They will have read-only access.</Card.Description>
			</div>
			<Button onclick={() => (showInviteModal = true)} size="sm">
				<UserPlus size={14} class="mr-1" />
				Invite
			</Button>
		</div>
	</Card.Header>
	<Card.Content>
		{#if isLoadingTeam}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		{:else if teamMembers.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
				<Users class="mb-2 h-8 w-8 opacity-50" />
				<p>No team members yet</p>
				<p class="text-sm">Invite team members to share access to this website's analytics.</p>
			</div>
		{:else}
			<div class="divide-y">
				{#each teamMembers as member}
					<div class="flex items-center justify-between py-3">
						<div class="flex items-center gap-3">
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
								{#if member.image}
									<img src={member.image} alt={member.name || member.email} class="h-8 w-8 rounded-full object-cover" />
								{:else}
									<span class="text-sm font-medium">{(member.name || member.email)[0].toUpperCase()}</span>
								{/if}
							</div>
							<div>
								<p class="text-sm font-medium">{member.name || member.email}</p>
								<p class="text-xs text-muted-foreground">{member.email}</p>
							</div>
						</div>
						<Button variant="ghost" size="icon-sm" onclick={() => removeMember(member.id)} class="text-muted-foreground hover:text-destructive">
							<X size={14} />
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

{#if removeError}
	<Alert.Root variant="destructive" class="mt-4">
		<Alert.Description>{removeError}</Alert.Description>
	</Alert.Root>
{/if}

<Dialog.Root bind:open={showInviteModal}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Invite Team Member</Dialog.Title>
			<Dialog.Description>Enter the email address of the user you want to invite. They must already have an account.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div>
				<Label for="invite-email" class="mb-2 block">Email address</Label>
				<Input id="invite-email" type="email" bind:value={inviteEmail} placeholder="user@example.com" />
			</div>

			{#if inviteError}
				<Alert.Root variant="destructive">
					<Alert.Description>{inviteError}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer class="gap-2">
			<Button
				variant="ghost"
				onclick={() => {
					showInviteModal = false;
					inviteEmail = '';
					inviteError = '';
				}}
			>
				Cancel
			</Button>
			<Button onclick={inviteMember} disabled={!inviteEmail.trim() || isInviting}>
				{#if isInviting}
					<Loader2 size={14} class="animate-spin" />
				{/if}
				Invite
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
