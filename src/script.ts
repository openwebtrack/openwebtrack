interface TrackingPayload {
	websiteId: string;
	domain: string;
	type: 'pageview' | 'custom';
	href: string;
	referrer: string | null;
	visitorId: string;
	sessionId: string;
	viewport: { width: number; height: number };
	screenWidth: number;
	screenHeight: number;
	language: string;
	timezone: string;
	browser?: string;
	browserVersion?: string;
	os?: string;
	osVersion?: string;
	deviceType?: string;
	isPwa?: boolean;
	title?: string;
	name?: string;
	data?: Record<string, unknown>;
}

interface TrackerWindow extends Window {
	owt?: { q?: unknown[][] };
	_trk_disabled?: boolean;
}

declare const __OWT_API_ENDPOINT__: string;

const COOKIE_VISITOR = '_trk_uid';
const COOKIE_SESSION = '_trk_ses';
const STORAGE_PAGEVIEW = '_trk_pv';
const SESSION_DAYS = 1 / 48;
const VISITOR_DAYS = 365;

const BOT_PATTERNS = ['headlesschrome', 'phantomjs', 'selenium', 'webdriver', 'puppeteer', 'playwright', 'python', 'curl', 'wget', 'java/', 'go-http', 'node.js', 'axios', 'postman'];

const SUSPICIOUS_PROPS = [
	'__webdriver_evaluate',
	'__selenium_evaluate',
	'__webdriver_script_function',
	'__webdriver_unwrapped',
	'__fxdriver_evaluate',
	'__driver_evaluate',
	'_Selenium_IDE_Recorder',
	'_selenium',
	'calledSelenium',
	'$cdc_asdjflasutopfhvcZLmcfl_'
];

const BROWSER_PATTERNS: [RegExp, string, (m: RegExpMatchArray) => string][] = [
	[/Firefox\/(\S+)/, 'Firefox', (m) => m[1]],
	[/Edg\/(\S+)/, 'Edge', (m) => m[1]],
	[/Chrome\/(\S+)/, 'Chrome', (m) => m[1]],
	[/Version\/(\S+).*Safari/, 'Safari', (m) => m[1]],
	[/OPR\/(\S+)/, 'Opera', (m) => m[1]],
	[/Opera\/(\S+)/, 'Opera', (m) => m[1]],
	[/MSIE (\d+\.?\d*)/, 'IE', (m) => m[1]],
	[/rv:(\d+\.?\d*)/, 'IE', (m) => m[1]]
];

const OS_PATTERNS: [RegExp, string, (m: RegExpMatchArray) => string][] = [
	[/Windows NT 10/, 'Windows', () => '10'],
	[/Windows NT 6\.3/, 'Windows', () => '8.1'],
	[/Windows NT 6\.2/, 'Windows', () => '8'],
	[/Windows NT 6\.1/, 'Windows', () => '7'],
	[/Mac OS X (\d+[._]\d+)/, 'macOS', (m) => m[1].replace('_', '.')],
	[/Android (\d+\.?\d*)/, 'Android', (m) => m[1]],
	[/OS (\d+[._]\d+)/, 'iOS', (m) => m[1].replace('_', '.')],
	[/Linux/, 'Linux', () => ''],
	[/CrOS/, 'Chrome OS', () => '']
];

((w: TrackerWindow) => {
	'use strict';

	const scriptEl = document.currentScript as HTMLScriptElement | null;
	if (!scriptEl) return;

	const attr = (name: string) => scriptEl.getAttribute(name);

	const ENDPOINT = (() => {
		if (typeof __OWT_API_ENDPOINT__ !== 'undefined' && __OWT_API_ENDPOINT__) return __OWT_API_ENDPOINT__;
		if (scriptEl.src) {
			try {
				const u = new URL(scriptEl.src);
				if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin + '/api/track';
			} catch {}
		}
		return '/api/track';
	})();

	const siteId = attr('data-website-id');
	const hostDomain = attr('data-domain');
	const localhostOk = attr('data-allow-localhost') === 'true';
	const fileProtoOk = attr('data-allow-file-protocol') === 'true';
	const isDebug = attr('data-debug') === 'true';

	let active = true;

	const pendingQueue: unknown[][] = [];
	if (w.owt?.q && Array.isArray(w.owt.q)) {
		pendingQueue.push(...w.owt.q.map((c) => Array.from(c as ArrayLike<unknown>)));
	}

	const isLocalhost = (host: string): boolean => {
		if (!host) return false;
		const h = host.toLowerCase();
		return ['localhost', '127.0.0.1', '::1'].includes(h) || /^127(\.[0-9]+){0,3}$/.test(h) || /^(\[)?::1?\]?$/.test(h) || h.endsWith('.local') || h.endsWith('.localhost');
	};

	const isAutomated = (): boolean => {
		try {
			const win = w as unknown as Record<string, unknown>;
			const nav = w.navigator;

			if (nav.webdriver === true || win.callPhantom || win._phantom || win.__nightmare) return true;
			if (!nav || !w.location || !w.document) return true;
			if (!nav.userAgent || nav.userAgent.length < 5) return true;

			const ua = nav.userAgent.toLowerCase();
			if (BOT_PATTERNS.some((p) => ua.includes(p))) return true;
			if (SUSPICIOUS_PROPS.some((p) => win[p] !== undefined)) return true;

			const el = document.documentElement;
			if (el?.getAttribute('webdriver') || el?.getAttribute('selenium') || el?.getAttribute('driver')) return true;
		} catch {
			return true;
		}
		return false;
	};

	const setCookie = (key: string, val: string, days: number) => {
		let str = `${key}=${val || ''}; path=/; SameSite=Lax`;
		if (days) {
			const d = new Date(Date.now() + days * 86400000);
			str += `; expires=${d.toUTCString()}`;
		}
		if (w.location.protocol === 'https:') str += '; Secure';

		const h = w.location.hostname;
		if (!isLocalhost(h) && w.location.protocol !== 'file:' && hostDomain) {
			const domain = h === hostDomain || h.endsWith('.' + hostDomain) ? hostDomain : h;
			str += `; domain=.${domain.replace(/^\./, '')}`;
		}
		document.cookie = str;
	};

	const getCookie = (key: string): string | null => {
		const needle = `${key}=`;
		for (const c of document.cookie.split(';')) {
			const trimmed = c.trim();
			if (trimmed.startsWith(needle)) return trimmed.slice(needle.length);
		}
		return null;
	};

	const generateId = (): string =>
		crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4) | 8) | 0).toString(16));

	const resolveId = (cookieKey: string, urlParam: string, days: number): string => {
		let id: string | null = null;
		try {
			id = new URL(w.location.href).searchParams.get(urlParam);
		} catch {}

		if (id) {
			setCookie(cookieKey, id, days);
			try {
				const u = new URL(w.location.href);
				u.searchParams.delete(urlParam);
				w.history.replaceState({}, '', u.toString());
			} catch {}
			return id;
		}

		id = getCookie(cookieKey);
		if (!id) {
			id = generateId();
			setCookie(cookieKey, id, days);
		}
		return id;
	};

	const parseUA = <T>(patterns: [RegExp, string, (m: RegExpMatchArray) => string][], defaultValue: T): T => {
		const ua = navigator.userAgent;
		for (const [regex, name, getVersion] of patterns) {
			const m = ua.match(regex);
			if (m) return { name, version: getVersion(m) } as T;
		}
		return defaultValue;
	};

	const parseDevice = (): string => {
		const ua = navigator.userAgent;
		if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
		if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
		return 'Desktop';
	};

	const detectPwa = (): boolean => {
		try {
			if (window.matchMedia('(display-mode: standalone)').matches) return true;
			if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
			if (document.referrer.startsWith('android-app://')) return true;
		} catch {}
		return false;
	};

	const createPayload = (): TrackingPayload | null => {
		try {
			const href = w.location.href;
			if (!href) return null;

			const browser = parseUA(BROWSER_PATTERNS, { name: 'Unknown', version: '' });
			const os = parseUA(OS_PATTERNS, { name: 'Unknown', version: '' });

			let timezone = '';
			try {
				timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
			} catch {}

			return {
				websiteId: siteId!,
				domain: hostDomain!,
				href,
				referrer: document.referrer || null,
				visitorId: resolveId(COOKIE_VISITOR, '_trk_uid', VISITOR_DAYS),
				sessionId: resolveId(COOKIE_SESSION, '_trk_ses', SESSION_DAYS),
				viewport: { width: w.innerWidth, height: w.innerHeight },
				screenWidth: screen?.width || 0,
				screenHeight: screen?.height || 0,
				language: navigator.language || '',
				timezone,
				browser: browser.name,
				browserVersion: browser.version,
				os: os.name,
				osVersion: os.version,
				deviceType: parseDevice(),
				isPwa: detectPwa(),
				title: document.title || '',
				type: 'pageview'
			};
		} catch {
			return null;
		}
	};

	const transmit = (payload: TrackingPayload, cb?: (status: number) => void) => {
		if (w._trk_disabled || isAutomated()) {
			cb?.(200);
			return;
		}

		fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true
		})
			.then((res) => {
				if (res.ok) setCookie(COOKIE_SESSION, resolveId(COOKIE_SESSION, '_trk_ses', SESSION_DAYS), SESSION_DAYS);
				cb?.(res.status);
			})
			.catch(() => cb?.(500));
	};

	const cleanseValue = (v: unknown): string => {
		if (v == null) return '';
		return String(v)
			.slice(0, 255)
			.replace(/[<>'"&]/g, '')
			.replace(/javascript:/gi, '')
			.replace(/on\w+=/gi, '')
			.replace(/data:/gi, '')
			.replace(/vbscript:/gi, '')
			.trim();
	};

	const cleanseData = (input: Record<string, unknown>): Record<string, unknown> => {
		const out: Record<string, unknown> = {};
		let count = 0;

		for (const [k, v] of Object.entries(input)) {
			if (count >= 10) break;
			const key = k.toLowerCase();
			if (!/^[a-z0-9_-]+$/.test(key) || key.length > 32) continue;
			out[key] = cleanseValue(v);
			count++;
		}
		return out;
	};

	let prevPageTime = 0;
	let prevPageUrl = '';

	const recordPageview = (cb?: (status: number) => void) => {
		if (!active) return cb?.(200);

		const now = Date.now();
		const current = w.location.href;

		if (current === prevPageUrl && now - prevPageTime < 60000) return cb?.(200);

		prevPageTime = now;
		prevPageUrl = current;

		try {
			sessionStorage.setItem(STORAGE_PAGEVIEW, JSON.stringify({ time: now, url: current }));
		} catch {}

		const payload = createPayload();
		if (!payload) return cb?.(500);

		payload.type = 'pageview';
		transmit(payload, cb);
	};

	const recordCustomEvent = (name: string, data: Record<string, unknown>, cb?: (status: number) => void) => {
		if (!active) return cb?.(200);

		const payload = createPayload();
		if (!payload) return cb?.(500);

		payload.type = 'custom';
		payload.name = name;
		payload.data = cleanseData(data);
		transmit(payload, cb);
	};

	const processGoalClick = (el: Element) => {
		const goal = el.getAttribute('data-owt-goal')?.trim();
		if (!goal) return;

		const info: Record<string, string> = { eventName: goal };
		for (const attr of el.attributes) {
			if (attr.name.startsWith('data-owt-goal-')) {
				info[attr.name.slice(14).replace(/-/g, '_')] = attr.value;
			}
		}
		recordCustomEvent('goal', info);
	};

	const processExternalLink = (a: HTMLAnchorElement | null) => {
		if (!a?.href) return;

		try {
			const u = new URL(a.href);
			if (!['http:', 'https:'].includes(u.protocol)) return;

			const linkHost = u.hostname;
			const myHost = w.location.hostname;
			if (linkHost === myHost) return;

			const rootDomain = (h: string) =>
				h
					.replace(/^www\./, '')
					.split('.')
					.slice(-2)
					.join('.');
			if (rootDomain(linkHost) === rootDomain(myHost)) return;

			if (hostDomain && (linkHost === hostDomain || linkHost.endsWith('.' + hostDomain))) {
				u.searchParams.set('_trk_uid', resolveId(COOKIE_VISITOR, '_trk_uid', VISITOR_DAYS));
				u.searchParams.set('_trk_ses', resolveId(COOKIE_SESSION, '_trk_ses', SESSION_DAYS));
				a.href = u.toString();
			}
		} catch {}
	};

	const dispatch = (name: string, data?: unknown, cb?: (status: number) => void) => {
		if (!active || !name) return cb?.(200);
		recordCustomEvent(name, (data as Record<string, unknown>) || {}, cb);
	};

	(w as unknown as Record<string, unknown>).owt = {
		trackEvent: (n: string, d?: Record<string, unknown>, c?: (s: number) => void) => dispatch(n, d, c)
	};
	delete (w.owt as unknown as Record<string, unknown>)?.q;

	if (isAutomated()) active = false;
	if (active && ((isLocalhost(w.location.hostname) && !localhostOk) || (w.location.protocol === 'file:' && !fileProtoOk))) active = false;
	if (active && w !== w.parent && !isDebug) active = false;
	if (active && (!siteId || !hostDomain)) active = false;
	if (!active) return;

	for (const call of pendingQueue) {
		try {
			dispatch.apply(null, call as [string, unknown]);
		} catch {}
	}

	try {
		const stored = sessionStorage.getItem(STORAGE_PAGEVIEW);
		if (stored) {
			const { time, url } = JSON.parse(stored) as { time: number; url: string };
			prevPageTime = time || 0;
			prevPageUrl = url || '';
		}
	} catch {}

	const handleClick = (e: Event) => {
		const target = e.target instanceof Element ? e.target : null;
		if (!target) return;

		const goalEl = target.closest('[data-owt-goal]');
		if (goalEl) processGoalClick(goalEl);

		const linkEl = target.closest('a');
		if (linkEl) processExternalLink(linkEl as HTMLAnchorElement);
	};

	document.addEventListener('click', handleClick);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') handleClick(e);
	});

	let deferTimer: ReturnType<typeof setTimeout> | null = null;
	const schedulePageview = () => {
		if (deferTimer) clearTimeout(deferTimer);
		deferTimer = setTimeout(recordPageview, 100);
	};

	recordPageview();

	let lastPath = w.location.pathname;
	const origPush = history.pushState;
	history.pushState = function (...args) {
		origPush.apply(this, args);
		if (lastPath !== w.location.pathname) {
			lastPath = w.location.pathname;
			schedulePageview();
		}
	};

	w.addEventListener('popstate', () => {
		if (lastPath !== w.location.pathname) {
			lastPath = w.location.pathname;
			schedulePageview();
		}
	});
})(window as TrackerWindow);
