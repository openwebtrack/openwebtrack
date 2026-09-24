import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { SAAS_MODE } from '$lib/config';
import { json } from '@sveltejs/kit';

const AUTH_GOOGLE_CLIENT_ID = env.AUTH_GOOGLE_CLIENT_ID;
const AUTH_GOOGLE_CLIENT_SECRET = env.AUTH_GOOGLE_CLIENT_SECRET;

export const GET: RequestHandler = async ({ request }) => {
	const googleEnabled = AUTH_GOOGLE_CLIENT_ID && AUTH_GOOGLE_CLIENT_SECRET ? true : false;

	return json({ googleEnabled, method: SAAS_MODE ? 'magic-link' : 'password', saasMode: SAAS_MODE });
};
