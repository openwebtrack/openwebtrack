import { version } from '../../package.json';

export const APP_VERSION: string = version;

export const DOCKER_IMAGE = 'ghcr.io/openwebtrack/openwebtrack';

export interface ChangelogEntry {
	version: string;
	date: string;
	changes: { type: 'feature' | 'fix' | 'improvement'; text: string }[];
}

// Newest first. Add an entry here whenever the version in package.json is bumped.
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '2.1.0',
		date: '2026-10-13',
		changes: [
			{ type: 'feature', text: 'Import and export backups between OpenWebTrack instances' },
			{ type: 'feature', text: 'Optional import step when adding a new website' },
			{ type: 'fix', text: 'Flags now show for alternate country spellings like "Viet Nam"' },
			{ type: 'fix', text: 'Alert text no longer gets squeezed into a narrow column' }
		]
	},
	{
		version: '2.0.2',
		date: '2026-10-10',
		changes: [{ type: 'fix', text: 'Visitor avatars, flags, long URLs and browser detection in the dashboard' }]
	},
	{
		version: '2.0.1',
		date: '2026-09-28',
		changes: [
			{ type: 'fix', text: 'Security hardening: patched XSS, data leaks, webhook forgery and IP spoofing' },
			{ type: 'fix', text: 'Tidier live globe when crowded, and loading states on filter changes' },
			{ type: 'fix', text: 'Sparklines no longer overshoot below the baseline' },
			{ type: 'improvement', text: 'Dashboard and website list are fully mobile responsive' }
		]
	},
	{
		version: '2.0.0',
		date: '2026-09-08',
		changes: [
			{ type: 'feature', text: 'AI-powered insights with redesigned detail dialogs' },
			{ type: 'feature', text: 'Stripe revenue attribution with automatic webhooks' },
			{ type: 'feature', text: 'Multi-domain websites' },
			{ type: 'feature', text: 'Configurable limits and optional integrations' },
			{ type: 'improvement', text: 'New design system and unified account settings' },
			{ type: 'improvement', text: 'Consolidated notification settings' }
		]
	},
	{
		version: '0.1.7',
		date: '2026-07-25',
		changes: [{ type: 'feature', text: 'Account-wide MCP analytics server' }]
	},
	{
		version: '0.1.6',
		date: '2026-06-27',
		changes: [{ type: 'improvement', text: 'Dependency upgrades' }]
	},
	{
		version: '0.1.5',
		date: '2026-06-08',
		changes: [{ type: 'feature', text: 'History mode for the real-time visitor map' }]
	},
	{
		version: '0.1.4',
		date: '2026-04-18',
		changes: [{ type: 'feature', text: 'Cookieless tracking script' }]
	},
	{
		version: '0.1.3',
		date: '2026-04-09',
		changes: [
			{ type: 'feature', text: 'Revenue per visitor and conversion rate metrics' },
			{ type: 'improvement', text: 'Revenue and customer metrics in the metric details dialog' }
		]
	},
	{
		version: '0.1.2',
		date: '2026-04-07',
		changes: [
			{ type: 'feature', text: 'Funnels' },
			{ type: 'improvement', text: 'Search engine indexing disabled by default' }
		]
	},
	{
		version: '0.1.1',
		date: '2026-04-01',
		changes: [{ type: 'feature', text: 'Embeddable widgets' }]
	},
	{
		version: '0.1.0',
		date: '2026-04-01',
		changes: [{ type: 'feature', text: 'Public API and API keys' }]
	}
];

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
