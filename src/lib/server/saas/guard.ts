import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { SAAS_MODE } from '$lib/config';

export async function requireActiveSubscription(event: RequestEvent) {
	if (!SAAS_MODE) return;

	const headers = event.request.headers;

	const sessionResp = await event.fetch(`${event.url.origin}/api/auth/get-session`, { headers });
	if (!sessionResp.ok) throw error(401, 'Unauthorized');

	const subsResp = await event.fetch(
		`${event.url.origin}/api/auth/customer/state`,
		{ headers }
	);
	if (!subsResp.ok) throw error(402, 'Active subscription required');

	const state = await subsResp.json();
	const hasActive = state?.activeSubscriptions?.some(
		(sub: { status: string }) => sub.status === 'active'
	);

	if (!hasActive) throw error(402, 'Active subscription required');
}

export async function getSubscription(event: RequestEvent) {
	if (!SAAS_MODE) return null;

	const headers = event.request.headers;
	const sessionResp = await event.fetch(`${event.url.origin}/api/auth/get-session`, { headers });
	if (!sessionResp.ok) return null;

	const subsResp = await event.fetch(
		`${event.url.origin}/api/auth/customer/state`,
		{ headers }
	);
	if (!subsResp.ok) return null;

	const state = await subsResp.json();
	return state?.activeSubscriptions?.[0] ?? null;
}