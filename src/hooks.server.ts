import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import auth from '$lib/server/auth';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Only the embeddable widget may be framed; everything else is protected against clickjacking.
	if (!event.url.pathname.startsWith('/widget/')) {
		response.headers.set('X-Frame-Options', 'DENY');
	}

	if (env.ENABLE_INDEXING !== 'true') {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	}

	return response;
};

export const handle: Handle = handleBetterAuth;
