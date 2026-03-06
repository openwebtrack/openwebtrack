import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import db from '$lib/server/db';

if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET environment variable is not set');
if (!env.ORIGIN) throw new Error('ORIGIN environment variable is not set');

const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		enabled: true,
		disableSignUp: env.DISABLE_REGISTER === 'true'
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});

export default auth;
