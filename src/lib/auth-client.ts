import { createAuthClient } from 'better-auth/svelte';

const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || undefined
});

export default authClient;
