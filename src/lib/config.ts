import { env } from '$env/dynamic/public';

export const SAAS_MODE = env.PUBLIC_SAAS_MODE === 'true';

// Canonical public URL for the hosted app (embed codes, API examples, branding links).
// Matches the website theme host at https://openwebtrack.one.
export const SITE_URL = 'https://openwebtrack.one';