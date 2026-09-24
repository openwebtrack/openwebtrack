import { createAuthClient } from 'better-auth/svelte';
import { magicLinkClient } from 'better-auth/client/plugins';
import { stripeClient } from '@better-auth/stripe/client';
import { SAAS_MODE } from '$lib/config';

const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || undefined,
	// magicLinkClient is always registered so `signIn.magicLink` is typed;
	// the /auth page only calls it when SAAS_MODE is enabled.
	plugins: [magicLinkClient(), ...(SAAS_MODE ? [stripeClient({ subscription: true })] : [])]
});

export default authClient;
