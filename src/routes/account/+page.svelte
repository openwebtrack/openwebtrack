<script lang="ts">
	import { User, Lock, ArrowLeft, Check, Loader2, LogOut } from 'lucide-svelte';
	import authClient from '$lib/auth-client';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { data }: { data: PageData } = $props();

	let activeTab = $state('profile');

	let name = $state('');
	$effect(() => {
		name = data.user.name ?? '';
	});
	let isSavingProfile = $state(false);
	let profileError = $state('');
	let profileSuccess = $state(false);

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSavingPassword = $state(false);
	let passwordError = $state('');
	let passwordSuccess = $state(false);

	const saveProfile = async () => {
		if (!name.trim()) {
			profileError = 'Name is required';
			return;
		}

		isSavingProfile = true;
		profileError = '';
		profileSuccess = false;

		try {
			const { error } = await authClient.updateUser({ name });
			if (error) {
				profileError = error.message || 'Failed to update profile';
			} else {
				profileSuccess = true;
				setTimeout(() => (profileSuccess = false), 2000);
			}
		} catch (e) {
			profileError = e instanceof Error ? e.message : 'Failed to update profile';
		} finally {
			isSavingProfile = false;
		}
	};

	const handleLogout = async () => {
		await authClient.signOut();
		goto('/auth');
	};

	const savePassword = async () => {
		if (!currentPassword || !newPassword || !confirmPassword) {
			passwordError = 'All fields are required';
			return;
		}

		if (newPassword !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}

		if (newPassword.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			return;
		}

		isSavingPassword = true;
		passwordError = '';
		passwordSuccess = false;

		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword
			});
			if (error) {
				passwordError = error.message || 'Failed to change password';
			} else {
				passwordSuccess = true;
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				setTimeout(() => (passwordSuccess = false), 2000);
			}
		} catch (e) {
			passwordError = e instanceof Error ? e.message : 'Failed to change password';
		} finally {
			isSavingPassword = false;
		}
	};

	const sidebarItems = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'password', label: 'Password', icon: Lock }
	];
</script>

<svelte:head>
	<title>Account Settings</title>
</svelte:head>

<div class="min-h-screen bg-background p-8">
	<div class="mx-auto max-w-6xl">
		<div class="mb-8">
			<Button href="/dashboard" variant="ghost" class="mb-4 gap-2 text-muted-foreground">
				<ArrowLeft size={14} />
				Back
			</Button>
			<h1 class="text-2xl font-bold">Account Settings</h1>
		</div>

		<div class="flex flex-col gap-8 md:flex-row">
			<div class="w-full shrink-0 md:w-64">
				<nav class="space-y-1">
					{#each sidebarItems as item}
						<Button variant={activeTab === item.id ? 'secondary' : 'ghost'} onclick={() => (activeTab = item.id)} class="w-full justify-start">
							<item.icon size={18} class="mr-3" />
							{item.label}
						</Button>
					{/each}
				</nav>
			</div>

			<div class="flex-1 space-y-8 pb-20">
				{#if activeTab === 'profile'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<Card.Title>Profile</Card.Title>
								<Card.Description>Your account information.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								{#if profileError}
									<Alert.Root variant="destructive">
										{profileError}
									</Alert.Root>
								{/if}

								{#if profileSuccess}
									<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
										<Check size={16} />
										<Alert.Title>Profile updated successfully!</Alert.Title>
									</Alert.Root>
								{/if}

								<div class="space-y-2">
									<Label for="email">Email</Label>
									<Input type="email" id="email" value={data.user.email} disabled class="cursor-not-allowed opacity-50" />
								</div>

								<div class="space-y-2">
									<Label for="name">Name</Label>
									<Input type="text" id="name" bind:value={name} />
								</div>

								<div class="flex justify-end">
									<Button onclick={saveProfile} disabled={isSavingProfile} class="gap-2">
										{#if isSavingProfile}
											<Loader2 size={14} class="animate-spin" />
										{:else if profileSuccess}
											<Check size={14} />
										{/if}
										Save
									</Button>
								</div>
							</Card.Content>
						</Card.Root>

						<div class="mt-6 flex justify-end">
							<Button variant="ghost" size="sm" onclick={handleLogout} class="gap-2 text-muted-foreground hover:text-destructive">
								<LogOut size={14} />
								Log out
							</Button>
						</div>
					</div>
				{:else if activeTab === 'password'}
					<div in:fade={{ duration: 200 }}>
						<Card.Root>
							<Card.Header>
								<Card.Title>Change Password</Card.Title>
								<Card.Description>Update your account password.</Card.Description>
							</Card.Header>
							<Card.Content class="space-y-4">
								{#if passwordError}
									<Alert.Root variant="destructive">
										{passwordError}
									</Alert.Root>
								{/if}

								{#if passwordSuccess}
									<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
										<Check size={16} />
										<Alert.Title>Password changed successfully!</Alert.Title>
									</Alert.Root>
								{/if}

								<div class="space-y-2">
									<Label for="current-password">Current Password</Label>
									<Input type="password" id="current-password" bind:value={currentPassword} placeholder="••••••••" />
								</div>

								<div class="space-y-2">
									<Label for="new-password">New Password</Label>
									<Input type="password" id="new-password" bind:value={newPassword} placeholder="••••••••" />
								</div>

								<div class="space-y-2">
									<Label for="confirm-password">Confirm New Password</Label>
									<Input type="password" id="confirm-password" bind:value={confirmPassword} placeholder="••••••••" />
								</div>

								<div class="flex justify-end">
									<Button onclick={savePassword} disabled={isSavingPassword} class="gap-2">
										{#if isSavingPassword}
											<Loader2 size={14} class="animate-spin" />
										{:else if passwordSuccess}
											<Check size={14} />
										{/if}
										Change Password
									</Button>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
