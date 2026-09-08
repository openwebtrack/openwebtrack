import { createAuthClient } from 'better-auth/svelte';
import { stripeClient } from '@better-auth/stripe/client';
import { SAAS_MODE } from '$lib/config';

const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || undefined,
	plugins: [SAAS_MODE ? stripeClient({ subscription: true }) : null].filter(
		Boolean
	) as never[]
});

export default authClient;
