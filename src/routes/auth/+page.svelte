<script lang="ts">
	import { CircleAlert } from 'lucide-svelte';
	import authClient from '$lib/auth-client';
	import { goto } from '$app/navigation';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let isSignUp = $state(false);
	let loading = $state(false);
	let password = $state('');
	let error = $state('');
	let email = $state('');
	let name = $state('');

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			if (isSignUp) {
				const { error: signUpError } = await authClient.signUp.email({
					email,
					password,
					name
				});
				if (signUpError) {
					error = signUpError.message || 'An error occurred during sign up';
					return;
				}
			} else {
				const { error: signInError } = await authClient.signIn.email({
					email,
					password
				});
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
						{loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
