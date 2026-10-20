import { version } from '../../package.json';
import bundledChangelog from '../../changelog.json';

export const APP_VERSION: string = version;

export const DOCKER_IMAGE = 'ghcr.io/openwebtrack/openwebtrack';

export const CHANGELOG_URL = 'https://raw.githubusercontent.com/openwebtrack/openwebtrack/main/changelog.json';

const parse = (v: string): number[] | null => {
	const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
	return m ? m.slice(1).map(Number) : null;
};

export const isSemver = (v: string): boolean => parse(v) !== null;

/** Returns a positive number when a > b, negative when a < b, 0 when equal or unparsable. */
export const compareVersions = (a: string, b: string): number => {
	const pa = parse(a);
	const pb = parse(b);
	if (!pa || !pb) return 0;
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i];
	}
	return 0;
};

export type ChangeType = 'feature' | 'fix' | 'improvement';

export interface ChangelogEntry {
	version: string;
	date: string;
	changes: { type: ChangeType; text: string }[];
}

const CHANGE_TYPES: readonly string[] = ['feature', 'fix', 'improvement'];

const isEntry = (e: any): e is ChangelogEntry =>
	typeof e?.version === 'string' &&
	isSemver(e.version) &&
	typeof e.date === 'string' &&
	/^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
	Array.isArray(e.changes) &&
	e.changes.every((c: any) => CHANGE_TYPES.includes(c?.type) && typeof c.text === 'string');

/** Keeps only well-formed entries, newest first. Used for the bundled file and the copy fetched from GitHub. */
export const parseChangelog = (data: unknown): ChangelogEntry[] =>
	Array.isArray(data)
		? data
				.filter(isEntry)
				.map((e) => ({ version: e.version.replace(/^v/, ''), date: e.date, changes: e.changes.map((c) => ({ type: c.type, text: c.text })) }))
				.sort((a, b) => compareVersions(b.version, a.version))
		: [];

/** Merges the remote changelog into the bundled one; remote entries win for the same version. */
export const mergeChangelogs = (bundled: ChangelogEntry[], remote: ChangelogEntry[]): ChangelogEntry[] => {
	const byVersion = new Map(bundled.map((e) => [e.version, e]));
	for (const e of remote) byVersion.set(e.version, e);
	return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
};

// Release notes live in changelog.json at the repo root. Add an entry there whenever the version in package.json is bumped.
// The dashboard also fetches it from GitHub (CHANGELOG_URL), so older versions can show notes for releases they don't have yet.
export const CHANGELOG: ChangelogEntry[] = parseChangelog(bundledChangelog);
