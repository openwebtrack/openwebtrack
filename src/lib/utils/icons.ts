import getCountryCode from '$lib/utils/country-mapping';

// Icons are bundled locally in `static/icons` so the dashboard no longer
// depends on the (unreliable) Iconify API at `https://api.iconify.design`.
// They are extracted from the `@iconify-json/logos` and `@iconify-json/lucide`
// collections (see https://icon-sets.iconify.design) and served as plain SVGs.
const browserIcon = (name: string) => `/icons/browsers/${name}.svg`;
const osIcon = (name: string) => `/icons/os/${name}.svg`;
const uiIcon = (name: string) => `/icons/ui/${name}.svg`;

const DEFAULT_BROWSER_ICON = uiIcon('globe');
const DEFAULT_OS_ICON = uiIcon('monitor');

export const getBrowserIcon = (browser: string | null) => {
	if (!browser) return DEFAULT_BROWSER_ICON;
	const lower = browser.toLowerCase();

	if (lower.includes('chrome')) return browserIcon('chrome');
	if (lower.includes('firefox')) return browserIcon('firefox');
	if (lower.includes('safari')) return browserIcon('safari');
	if (lower.includes('edge')) return browserIcon('edge');
	if (lower.includes('opera')) return browserIcon('opera');
	if (lower.includes('msie') || lower.includes('trident') || lower.includes('iemobile') || lower.includes('explorer')) return browserIcon('internet-explorer');
	if (lower.includes('brave')) return browserIcon('brave');
	if (lower.includes('vivaldi')) return browserIcon('vivaldi');
	if (lower.includes('arc/') || lower.includes(' arc ')) return browserIcon('arc');

	return DEFAULT_BROWSER_ICON;
};

export const getOsIcon = (os: string | null) => {
	if (!os) return DEFAULT_OS_ICON;
	const lower = os.toLowerCase();

	if (lower.includes('windows')) return osIcon('windows');
	if (lower.includes('mac') || lower.includes('macos')) return osIcon('apple-white');
	if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return osIcon('apple-white');
	if (lower.includes('android')) return osIcon('android');
	if (lower.includes('ubuntu')) return osIcon('ubuntu');
	if (lower.includes('fedora')) return osIcon('fedora');
	if (lower.includes('linux')) return osIcon('linux');
	if (lower.includes('chrome os') || lower.includes('chromeos')) return browserIcon('chrome');

	return DEFAULT_OS_ICON;
};

export const getDeviceIcon = (device: string | null) => {
	if (!device) return DEFAULT_OS_ICON;
	const lower = device.toLowerCase();

	if (lower.includes('mobile') || lower.includes('phone')) return uiIcon('smartphone');
	if (lower.includes('tablet') || lower.includes('ipad')) return uiIcon('tablet');
	if (lower.includes('desktop')) return DEFAULT_OS_ICON;

	return DEFAULT_OS_ICON;
};

export const getFlagUrl = (code: string | null | undefined) => (code ? `https://flagcdn.com/w80/${code.toLowerCase()}.png` : '');

export const getCountryFlag = (countryName: string | null) => {
	if (!countryName || countryName === 'Unknown') return undefined;
	const code = getCountryCode(countryName);
	if (!code) return undefined;
	return getFlagUrl(code);
};

export const getRegionIcon = () => uiIcon('map');
export const getCityIcon = () => uiIcon('map-pin');
