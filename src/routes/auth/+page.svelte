<script lang="ts">
	import { CircleAlert, LoaderCircle } from 'lucide-svelte';
	import authClient from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import axios from 'axios';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let authConfig = $state({ googleEnabled: false });
	let isSignUp = $state(false);
	let loading = $state(false);
	let password = $state('');
	let error = $state('');
	let email = $state('');
	let name = $state('');

	const getAuthConfig = async () => {
		try {
			const { data } = await axios.get('/api/auth-config');
			authConfig = data;
		} catch (e) {
			console.error('Failed to fetch auth config', e);
		}
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isSignUp) {
				const { error: signUpError } = await authClient.signUp.email({ email, password, name });
				if (signUpError) {
					error = signUpError.message || 'An error occurred during sign up';
					return;
				}
			} else {
				const { error: signInError } = await authClient.signIn.email({ email, password });
				if (signInError) {
					error = signInError.message || 'An error occurred during sign in';
					return;
				}
			}
			goto('/dashboard');
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	};

	const handleSocial = async (provider: string) => {
		error = '';
		loading = true;

		const res = await authClient.signIn.social({ provider });
		if (res.error) {
			error = res.error?.message || 'An error occurred during social sign in';
			loading = false;
			return;
		}

		loading = false;
		goto('/dashboard');
	};

	onMount(() => {
		getAuthConfig();
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="w-full max-w-md p-8">
		<Card.Root class="border-border">
			<Card.Header class="text-center">
				<Card.Title class="text-2xl">{isSignUp ? 'Create Account' : 'Sign In'}</Card.Title>
				<Card.Description>
					{isSignUp ? 'Already have an account?' : "Don't have an account?"}
					<Button variant="link" class="px-1" onclick={() => (isSignUp = !isSignUp)}>
						{isSignUp ? 'Sign in' : 'Sign up'}
					</Button>
				</Card.Description>
			</Card.Header>

			<Card.Content>
				{#if error}
					<Alert.Root variant="destructive" class="mb-4">
						<CircleAlert class="h-4 w-4" />
						<Alert.Description>{error}</Alert.Description>
					</Alert.Root>
				{/if}

				<form onsubmit={handleSubmit} class="space-y-4">
					{#if isSignUp}
						<div class="space-y-2">
							<Label for="name">Name</Label>
							<Input type="text" id="name" bind:value={name} required placeholder="Your name" />
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input type="email" id="email" bind:value={email} required placeholder="you@example.com" />
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input type="password" id="password" bind:value={password} required placeholder="••••••••" />
					</div>

					<Button type="submit" disabled={loading} class="w-full">
						{#if loading}
							<LoaderCircle class="animate-spin" />
						{/if}
						{isSignUp ? 'Sign Up' : 'Sign In'}
					</Button>
				</form>

				<Button variant="outline" class="mt-3 w-full" onclick={async () => await handleSocial('google')} disabled={!authConfig.googleEnabled || loading}>
					{#if loading}
						<LoaderCircle class="animate-spin" />
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								fill-rule="evenodd"
								d="M12.037 21.998a10.3 10.3 0 0 1-7.168-3.049a9.9 9.9 0 0 1-2.868-7.118a9.95 9.95 0 0 1 3.064-6.949A10.37 10.37 0 0 1 12.212 2h.176a9.94 9.94 0 0 1 6.614 2.564L16.457 6.88a6.2 6.2 0 0 0-4.131-1.566a6.9 6.9 0 0 0-4.794 1.913a6.62 6.62 0 0 0-2.045 4.657a6.6 6.6 0 0 0 1.882 4.723a6.9 6.9 0 0 0 4.725 2.07h.143c1.41.072 2.8-.354 3.917-1.2a5.77 5.77 0 0 0 2.172-3.41l.043-.117H12.22v-3.41h9.678q.113.927.1 1.859c-.099 5.741-4.017 9.6-9.746 9.6l-.215-.002Z"
								clip-rule="evenodd"
							/></svg
						>
					{/if}

					Sign {isSignUp ? 'up' : 'in'} with Google</Button
				>
			</Card.Content>
		</Card.Root>
	</div>
</div>
