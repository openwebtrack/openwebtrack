interface TrackingPayload {
	websiteId: string;
	domain: string;
	type: 'pageview' | 'custom' | 'identify' | 'payment' | 'heartbeat';
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

interface UserProfile {
	user_id?: string;
	name?: string;
	email?: string;
	image?: string;
}

declare const __OWT_API_ENDPOINT__: string;

((w: TrackerWindow) => {
	'use strict';

	const scriptEl = document.currentScript as HTMLScriptElement | null;
	if (!scriptEl) return;
	const ATTR_PREFIX = 'data-';
	const readAttr = scriptEl.getAttribute.bind(scriptEl);

	const resolveEndpoint = () => {
		if (typeof __OWT_API_ENDPOINT__ !== 'undefined' && __OWT_API_ENDPOINT__) return __OWT_API_ENDPOINT__;
		if (scriptEl.src) {
			try {
				const u = new URL(scriptEl.src);
				if (u.protocol === 'http:' || u.protocol === 'https:') {
					return u.origin + '/api/track';
				}
			} catch {
				/* empty */
			}
		}
		return '/api/track';
	};

	const ENDPOINT = resolveEndpoint();

	const siteId = readAttr(ATTR_PREFIX + 'website-id');
	const hostDomain = readAttr(ATTR_PREFIX + 'domain');
	const localhostOk = readAttr(ATTR_PREFIX + 'allow-localhost') === 'true';
	const fileProtoOk = readAttr(ATTR_PREFIX + 'allow-file-protocol') === 'true';
	const isDebug = readAttr(ATTR_PREFIX + 'debug') === 'true';

	let active = true;

	const pendingQueue: unknown[][] = [];
	if (w.owt && w.owt.q && Array.isArray(w.owt.q)) {
		pendingQueue.push(...w.owt.q.map((c) => Array.from(c as ArrayLike<unknown>)));
	}

	const checkLocalhost = (host: string): boolean => {
		if (!host) return false;
		const h = host.toLowerCase();
		if (['localhost', '127.0.0.1', '::1'].includes(h)) return true;
		if (/^127(\.[0-9]+){0,3}$/.test(h)) return true;
		if (/^(\[)?::1?\]?$/.test(h)) return true;
		if (h.endsWith('.local') || h.endsWith('.localhost')) return true;
		return false;
	};

	const detectAutomation = (): boolean => {
		try {
			const win = w as unknown as Record<string, unknown>;
			if (w.navigator.webdriver === true || win.callPhantom || win._phantom || win.__nightmare) {
				return true;
			}

			if (!w.navigator || !w.location || !w.document || typeof w.navigator !== 'object' || typeof w.location !== 'object' || typeof w.document !== 'object') {
				return true;
			}

			const nav = w.navigator;
			if (!nav.userAgent || nav.userAgent === '' || nav.userAgent === 'undefined' || nav.userAgent.length < 5) {
				return true;
			}

			const ua = nav.userAgent.toLowerCase();
			const botPatterns = ['headlesschrome', 'phantomjs', 'selenium', 'webdriver', 'puppeteer', 'playwright', 'python', 'curl', 'wget', 'java/', 'go-http', 'node.js', 'axios', 'postman'];
			if (botPatterns.some((p) => ua.includes(p))) return true;

			const suspiciousProps = [
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
			for (const prop of suspiciousProps) {
				if (win[prop] !== undefined) return true;
			}

			if (document.documentElement) {
				if (document.documentElement.getAttribute('webdriver') || document.documentElement.getAttribute('selenium') || document.documentElement.getAttribute('driver')) {
					return true;
				}
			}
		} catch {
			return true;
		}
		return false;
	};

	const writeCookie = (key: string, val: string, days: number) => {
		let exp = '';
		if (days) {
			const d = new Date();
			d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
			exp = '; expires=' + d.toUTCString();
		}
		let str = key + '=' + (val || '') + exp + '; path=/; SameSite=Lax';
		const isSecure = w.location.protocol === 'https:';
		if (isSecure) {
			str += '; Secure';
		}
		if (!checkLocalhost(w.location.hostname) && w.location.protocol !== 'file:' && hostDomain) {
			const h = w.location.hostname;
			str += h === hostDomain || h.endsWith('.' + hostDomain) ? '; domain=.' + hostDomain.replace(/^\./, '') : '; domain=.' + h.replace(/^\./, '');
		}
		document.cookie = str;
	};

	const readCookie = (key: string): string | null => {
		const needle = key + '=';
		const parts = document.cookie.split(';');
		for (let i = 0; i < parts.length; i++) {
			let c = parts[i];
			while (c.charAt(0) === ' ') c = c.substring(1);
			if (c.indexOf(needle) === 0) return c.substring(needle.length);
		}
		return null;
	};

	const createId = (): string => {
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
			const r = (Math.random() * 16) | 0;
			return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
		});
	};

	const scrubUrl = () => {
		try {
			const u = new URL(w.location.href);
			if (u.searchParams.has('_trk_uid') || u.searchParams.has('_trk_ses')) {
				u.searchParams.delete('_trk_uid');
				u.searchParams.delete('_trk_ses');
				w.history.replaceState({}, '', u.toString());
			}
		} catch {
			/* empty */
		}
	};

	const resolveVisitorId = (): string => {
		let vid: string | null = null;
		try {
			vid = new URL(w.location.href).searchParams.get('_trk_uid');
		} catch {
			/* empty */
		}

		if (vid) {
			writeCookie('_trk_uid', vid, 365);
			scrubUrl();
			return vid;
		}

		vid = readCookie('_trk_uid');
		if (!vid) {
			vid = createId();
			writeCookie('_trk_uid', vid, 365);
		}
		return vid;
	};

	const resolveSessionId = (): string => {
		let sid: string | null = null;
		try {
			sid = new URL(w.location.href).searchParams.get('_trk_ses');
		} catch {
			/* empty */
		}

		if (sid) {
			writeCookie('_trk_ses', sid, 1 / 48);
			return sid;
		}

		sid = readCookie('_trk_ses');
		if (!sid) {
			sid = createId();
			writeCookie('_trk_ses', sid, 1 / 48);
		}
		return sid;
	};

	const parseBrowser = (): { browser: string; version: string } => {
		const ua = navigator.userAgent;
		let name = 'Unknown';
		let ver = '';

		if (ua.includes('Firefox/')) {
			name = 'Firefox';
			ver = ua.split('Firefox/')[1]?.split(' ')[0] || '';
		} else if (ua.includes('Edg/')) {
			name = 'Edge';
			ver = ua.split('Edg/')[1]?.split(' ')[0] || '';
		} else if (ua.includes('Chrome/')) {
			name = 'Chrome';
			ver = ua.split('Chrome/')[1]?.split(' ')[0] || '';
		} else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
			name = 'Safari';
			ver = ua.split('Version/')[1]?.split(' ')[0] || '';
		} else if (ua.includes('Opera') || ua.includes('OPR/')) {
			name = 'Opera';
			ver = ua.split('OPR/')[1]?.split(' ')[0] || ua.split('Opera/')[1]?.split(' ')[0] || '';
		} else if (ua.includes('MSIE') || ua.includes('Trident/')) {
			name = 'IE';
			ver = ua.includes('MSIE') ? ua.split('MSIE ')[1]?.split(';')[0] || '' : ua.split('rv:')[1]?.split(')')[0] || '';
		}

		return { browser: name, version: ver };
	};

	const parseOS = (): { os: string; version: string } => {
		const ua = navigator.userAgent;
		let name = 'Unknown';
		let ver = '';

		if (ua.includes('Windows NT 10')) {
			name = 'Windows';
			ver = '10';
		} else if (ua.includes('Windows NT 6.3')) {
			name = 'Windows';
			ver = '8.1';
		} else if (ua.includes('Windows NT 6.2')) {
			name = 'Windows';
			ver = '8';
		} else if (ua.includes('Windows NT 6.1')) {
			name = 'Windows';
			ver = '7';
		} else if (ua.includes('Mac OS X')) {
			name = 'macOS';
			const m = ua.match(/Mac OS X (\d+[._]\d+)/);
			ver = m ? m[1].replace('_', '.') : '';
		} else if (ua.includes('Android')) {
			name = 'Android';
			const m = ua.match(/Android (\d+\.?\d*)/);
			ver = m ? m[1] : '';
		} else if (ua.includes('iPhone') || ua.includes('iPad')) {
			name = 'iOS';
			const m = ua.match(/OS (\d+[._]\d+)/);
			ver = m ? m[1].replace('_', '.') : '';
		} else if (ua.includes('Linux')) {
			name = 'Linux';
		} else if (ua.includes('CrOS')) {
			name = 'Chrome OS';
		}

		return { os: name, version: ver };
	};

	const parseDevice = (): string => {
		const ua = navigator.userAgent;
		if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
		if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
		return 'Desktop';
	};

	const detectPwa = (): boolean => {
		try {
			const nav = navigator as Navigator & { standalone?: boolean };
			if (window.matchMedia('(display-mode: standalone)').matches) return true;
			if (nav.standalone === true) return true;
			if (document.referrer.startsWith('android-app://')) return true;
		} catch {
			/* empty */
		}
		return false;
	};

	const createPayload = (): TrackingPayload | null => {
		try {
			const href = w.location.href;
			if (!href) return null;

			const { browser, version: browserVersion } = parseBrowser();
			const { os, version: osVersion } = parseOS();
			const deviceType = parseDevice();
			const isPwa = detectPwa();

			let screenWidth = 0;
			let screenHeight = 0;
			try {
				screenWidth = screen.width || 0;
				screenHeight = screen.height || 0;
			} catch {
				/* empty */
			}

			let timezone = '';
			try {
				timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
			} catch {
				/* empty */
			}

			return {
				websiteId: siteId!,
				domain: hostDomain!,
				href,
				referrer: document.referrer || null,
				visitorId: resolveVisitorId(),
				sessionId: resolveSessionId(),
				viewport: { width: w.innerWidth, height: w.innerHeight },
				screenWidth,
				screenHeight,
				language: navigator.language || '',
				timezone,
				browser,
				browserVersion,
				os,
				osVersion,
				deviceType,
				isPwa,
				title: document.title || '',
				type: 'pageview'
			};
		} catch {
			return null;
		}
	};

	const transmit = (payload: TrackingPayload, cb?: (status: number) => void) => {
		if (w._trk_disabled) {
			cb?.(200);
			return;
		}

		if (detectAutomation()) {
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
				if (res.ok) {
					writeCookie('_trk_ses', resolveSessionId(), 1 / 48);
				}
				cb?.(res.status);
			})
			.catch(() => {
				cb?.(500);
			});
	};

	const cleanseValue = (v: unknown): string => {
		if (v == null) return '';
		let s = String(v);
		if (s.length > 255) s = s.substring(0, 255);
		return s
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
			const normKey = k.toLowerCase();
			if (!/^[a-z0-9_-]+$/.test(normKey) || normKey.length > 32) continue;
			out[normKey] = cleanseValue(v);
			count++;
		}

		return out;
	};

	let prevPageTime = 0;
	let prevPageUrl = '';

	const recordPageview = (cb?: (status: number) => void) => {
		if (!active) {
			cb?.(200);
			return;
		}

		const now = Date.now();
		const current = w.location.href;

		if (current === prevPageUrl && now - prevPageTime < 60000) {
			cb?.(200);
			return;
		}

		prevPageTime = now;
		prevPageUrl = current;

		try {
			sessionStorage.setItem('_trk_pv', JSON.stringify({ time: now, url: current }));
		} catch {
			/* empty */
		}

		const payload = createPayload();
		if (!payload) {
			cb?.(500);
			return;
		}

		payload.type = 'pageview';
		transmit(payload, cb);
	};

	const recordCustomEvent = (eventName: string, eventData: Record<string, unknown>, cb?: (status: number) => void) => {
		if (!active) {
			cb?.(200);
			return;
		}

		const payload = createPayload();
		if (!payload) {
			cb?.(500);
			return;
		}

		payload.type = 'custom';
		payload.name = eventName;
		payload.data = cleanseData(eventData);
		transmit(payload, cb);
	};

	const recordIdentify = (uid: string, profile: UserProfile, cb?: (status: number) => void) => {
		if (!active) {
			cb?.(200);
			return;
		}

		const payload = createPayload();
		if (!payload) {
			cb?.(500);
			return;
		}

		payload.type = 'identify';
		payload.data = { user_id: uid, name: profile.name || '', email: profile.email || '', image: profile.image || '' };
		transmit(payload, cb);
	};

	const recordPayment = (emailAddr: string, extras?: Record<string, unknown>, cb?: (status: number) => void) => {
		if (!active) {
			cb?.(200);
			return;
		}

		const payload = createPayload();
		if (!payload) {
			cb?.(500);
			return;
		}

		payload.type = 'payment';
		payload.data = { email: emailAddr, ...extras };
		transmit(payload, cb);
	};

	const processGoalClick = (el: Element) => {
		const goal = el.getAttribute('data-owt-goal');
		if (!goal?.trim()) return;

		const info: Record<string, string> = { eventName: goal.trim() };
		for (const attr of el.attributes) {
			if (attr.name.startsWith('data-owt-goal-') && attr.name !== 'data-owt-goal') {
				info[attr.name.substring(14).replace(/-/g, '_')] = attr.value;
			}
		}
		recordCustomEvent('goal', info);
	};

	const processExternalLink = (a: HTMLAnchorElement | null) => {
		if (!a?.href) return;

		try {
			const u = new URL(a.href);
			if (u.protocol !== 'http:' && u.protocol !== 'https:') return;

			const linkHost = u.hostname;
			const myHost = w.location.hostname;

			if (linkHost === myHost) return;

			const rootDomain = (h: string) => {
				const p = h.replace(/^www\./, '').split('.');
				return p.length >= 2 ? p.slice(-2).join('.') : h;
			};

			if (rootDomain(linkHost) === rootDomain(myHost)) return;

			if (hostDomain && (linkHost === hostDomain || linkHost.endsWith('.' + hostDomain))) {
				u.searchParams.set('_trk_uid', resolveVisitorId());
				u.searchParams.set('_trk_ses', resolveSessionId());
				a.href = u.toString();
			}
		} catch {
			/* empty */
		}
	};

	const dispatch = (name: string, data?: unknown, cb?: (status: number) => void) => {
		if (!active || !name) {
			cb?.(200);
			return;
		}

		if (name === 'payment') {
			const p = data as { email?: string } | undefined;
			if (!p?.email) {
				cb?.(400);
				return;
			}
			recordPayment(p.email, data as Record<string, unknown>, cb);
		} else if (name === 'identify') {
			const i = data as ({ user_id?: string } & UserProfile) | undefined;
			if (!i?.user_id) {
				cb?.(400);
				return;
			}
			recordIdentify(i.user_id, i, cb);
		} else {
			recordCustomEvent(name, (data as Record<string, unknown>) || {}, cb);
		}
	};

	(w as unknown as Record<string, unknown>).owt = dispatch;
	(w as unknown as Record<string, unknown>).trackEvent = (n: string, d: Record<string, unknown>, cb?: (status: number) => void) => dispatch(n, d, cb);
	delete (w.owt as unknown as Record<string, unknown>)?.q;

	if (detectAutomation()) {
		active = false;
	}

	if (active) {
		if ((checkLocalhost(w.location.hostname) && !localhostOk) || (w.location.protocol === 'file:' && !fileProtoOk)) {
			active = false;
		}
	}

	if (active && w !== w.parent && !isDebug) {
		active = false;
	}

	if (active && (!siteId || !hostDomain)) {
		active = false;
	}

	if (!active) return;

	for (const call of pendingQueue) {
		try {
			dispatch.apply(null, call as [string, unknown]);
		} catch {
			/* empty */
		}
	}

	try {
		const stored = sessionStorage.getItem('_trk_pv');
		if (stored) {
			const { time, url } = JSON.parse(stored) as { time: number; url: string };
			prevPageTime = time || 0;
			prevPageUrl = url || '';
		}
	} catch {
		/* empty */
	}

	document.addEventListener('click', (e) => {
		const goalEl = e.target instanceof Element ? e.target.closest('[data-owt-goal]') : null;
		if (goalEl) processGoalClick(goalEl);

		const linkEl = e.target instanceof Element ? e.target.closest('a') : null;
		if (linkEl) processExternalLink(linkEl as HTMLAnchorElement);
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			const goalEl = e.target instanceof Element ? e.target.closest('[data-owt-goal]') : null;
			if (goalEl) processGoalClick(goalEl);

			const linkEl = e.target instanceof Element ? e.target.closest('a') : null;
			if (linkEl) processExternalLink(linkEl as HTMLAnchorElement);
		}
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
