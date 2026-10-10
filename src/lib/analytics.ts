import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { SAAS_MODE } from '$lib/config';

// Self-tracking for the hosted cloud version only. Self-hosted installs never load
// the script unless they explicitly set PUBLIC_OWT_WEBSITE_ID themselves.
const OWT_WEBSITE_ID = SAAS_MODE ? env.PUBLIC_OWT_WEBSITE_ID || '' : '';
const OWT_DOMAIN = env.PUBLIC_OWT_DOMAIN || 'openwebtrack.one';
const OWT_SCRIPT_URL = env.PUBLIC_OWT_SCRIPT_URL || 'https://cloud.openwebtrack.one/script.js';

type Owt = {
	q?: unknown[][];
	trackEvent?: (name: string, data?: Record<string, unknown>) => void;
};

/** Inject the tracking script once (root layout onMount). */
export function loadTracker() {
	if (!browser || !OWT_WEBSITE_ID || document.querySelector('script[data-owt-self]')) return;
	const s = document.createElement('script');
	s.defer = true;
	s.src = OWT_SCRIPT_URL;
	s.dataset.websiteId = OWT_WEBSITE_ID;
	s.dataset.domain = OWT_DOMAIN;
	s.dataset.owtSelf = '';
	document.head.appendChild(s);
}

export function track(name: string, data?: Record<string, unknown>) {
	if (!browser || !OWT_WEBSITE_ID) return;
	const w = window as unknown as { owt?: Owt };
	try {
		if (w.owt?.trackEvent) w.owt.trackEvent(name, data);
		// Script not loaded yet - it drains `owt.q` on init
		else (w.owt ??= { q: [] }).q?.push([name, data]);
	} catch {}
}
