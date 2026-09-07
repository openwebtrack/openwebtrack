import { createAuthClient } from 'better-auth/svelte';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { SAAS_MODE } from '$lib/config';

async function loadPolarPlugin(): Promise<BetterAuthClientPlugin | null> {
	if (!SAAS_MODE) return null;
	try {
		const mod = await import('@polar-sh/better-auth/client');
		return mod.polarClient() as BetterAuthClientPlugin;
	} catch {
		console.warn('[auth-client] @polar-sh/better-auth/client not installed');
		return null;
	}
}

const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || undefined,
	plugins: [await loadPolarPlugin()].filter(Boolean) as never[]
});

export default authClient;