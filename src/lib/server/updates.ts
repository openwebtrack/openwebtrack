import { env } from '$env/dynamic/private';
import { SAAS_MODE } from '$lib/config';
import { APP_VERSION, compareVersions, isSemver } from '$lib/changelog';

const REPOSITORY = 'openwebtrack/openwebtrack';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const FAILURE_TTL = 60 * 60 * 1000;
const TIMEOUT = 5000;

let cache: { latest: string | null; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

const fetchLatestTag = async (): Promise<string | null> => {
	const tokenRes = await fetch(`https://ghcr.io/token?scope=repository:${REPOSITORY}:pull`, { signal: AbortSignal.timeout(TIMEOUT) });
	if (!tokenRes.ok) return null;
	const { token } = (await tokenRes.json()) as { token?: string };
	if (!token) return null;

	const tagsRes = await fetch(`https://ghcr.io/v2/${REPOSITORY}/tags/list?n=1000`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(TIMEOUT)
	});
	if (!tagsRes.ok) return null;
	const { tags } = (await tagsRes.json()) as { tags?: string[] };

	const versions = (tags ?? []).filter(isSemver).sort(compareVersions);
	const latest = versions.at(-1);
	return latest ? latest.replace(/^v/, '') : null;
};

/** Latest published Docker image version, or null when unknown (offline, disabled, cloud). Never throws. */
export const getLatestVersion = async (): Promise<string | null> => {
	if (SAAS_MODE || env.DISABLE_UPDATE_CHECK === 'true') return null;
	if (cache && cache.expiresAt > Date.now()) return cache.latest;

	inflight ??= fetchLatestTag()
		.catch(() => null)
		.then((latest) => {
			cache = { latest, expiresAt: Date.now() + (latest ? CACHE_TTL : FAILURE_TTL) };
			return latest;
		})
		.finally(() => {
			inflight = null;
		});

	return inflight;
};

export const getUpdateStatus = async () => {
	const latest = await getLatestVersion();
	return {
		current: APP_VERSION,
		latest,
		updateAvailable: latest !== null && compareVersions(latest, APP_VERSION) > 0
	};
};
