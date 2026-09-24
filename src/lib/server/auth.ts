import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import db from '$lib/server/db';
import { SAAS_MODE } from '$lib/config';

if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET environment variable is not set');
if (!env.ORIGIN) throw new Error('ORIGIN environment variable is not set');

const stripePlugins = SAAS_MODE
	? (await import('$lib/server/saas/stripe')).getStripePlugins()
	: [];

const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		// SaaS mode uses passwordless magic-link auth instead of email & password
		enabled: !SAAS_MODE,
		disableSignUp: env.DISABLE_REGISTER === 'true'
	},
	socialProviders: {
		google: {
			enabled: env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET ? true : false,
			clientId: env?.AUTH_GOOGLE_CLIENT_ID || '',
			clientSecret: env?.AUTH_GOOGLE_CLIENT_SECRET || ''
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent),
		// Passwordless auth for SaaS mode: user receives a sign-in link by email
		...(SAAS_MODE
			? [
					magicLink({
						expiresIn: 60 * 5,
						disableSignUp: env.DISABLE_REGISTER === 'true',
						sendMagicLink: async ({ email, url }) => {
							const { sendEmail } = await import('$lib/server/email');
							const { default: MagicLinkEmail } = await import(
								'$lib/server/email/templates/MagicLinkEmail'
							);
							const { createElement } = await import('react');
							await sendEmail({
								to: email,
								subject: 'Sign in to OpenWebTrack',
								plain: `Click the link below to sign in to OpenWebTrack:\n\n${url}\n\nThis link expires in 5 minutes. If you didn't request this email, you can safely ignore it.`,
								children: createElement(MagicLinkEmail, { url })
							});
						}
					})
				]
			: []),
		...stripePlugins
	]
});

export default auth;