import getCountryCode from '$lib/utils/country-mapping';

export const getBrowserIcon = (browser: string | null) => {
	if (!browser) return 'https://api.iconify.design/lucide:globe.svg?color=%2371717a';
	const lower = browser.toLowerCase();

	if (lower.includes('chrome')) return 'https://api.iconify.design/logos:chrome.svg';
	if (lower.includes('firefox')) return 'https://api.iconify.design/logos:firefox.svg';
	if (lower.includes('safari')) return 'https://api.iconify.design/logos:safari.svg';
	if (lower.includes('edge')) return 'https://api.iconify.design/logos:microsoft-edge.svg';
	if (lower.includes('opera')) return 'https://api.iconify.design/logos:opera.svg';
	if (lower.includes('msie') || lower.includes('trident') || lower.includes('iemobile') || lower.includes('explorer')) return 'https://api.iconify.design/logos:internet-explorer.svg';
	if (lower.includes('brave')) return 'https://api.iconify.design/logos:brave.svg';
	if (lower.includes('vivaldi')) return 'https://api.iconify.design/logos:vivaldi.svg';
	if (lower.includes('arc/') || lower.includes(' arc ')) return 'https://api.iconify.design/logos:arc.svg';

	return 'https://api.iconify.design/lucide:globe.svg?color=%2371717a';
};

export const getOsIcon = (os: string | null) => {
	if (!os) return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
	const lower = os.toLowerCase();

	if (lower.includes('windows')) return 'https://api.iconify.design/logos:microsoft-windows-icon.svg';
	if (lower.includes('mac') || lower.includes('macos')) return 'https://api.iconify.design/mdi:apple.svg?color=%23ffffff';
	if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return 'https://api.iconify.design/mdi:apple.svg?color=%23ffffff';
	if (lower.includes('android')) return 'https://api.iconify.design/logos:android-icon.svg';
	if (lower.includes('linux')) return 'https://api.iconify.design/logos:linux-tux.svg';
	if (lower.includes('ubuntu')) return 'https://api.iconify.design/logos:ubuntu.svg';
	if (lower.includes('fedora')) return 'https://api.iconify.design/logos:fedora.svg';
	if (lower.includes('chrome os') || lower.includes('chromeos')) return 'https://api.iconify.design/logos:chrome.svg';

	return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
};

export const getDeviceIcon = (device: string | null) => {
	if (!device) return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
	const lower = device.toLowerCase();

	if (lower.includes('mobile') || lower.includes('phone')) return 'https://api.iconify.design/lucide:smartphone.svg?color=%2371717a';
	if (lower.includes('tablet') || lower.includes('ipad')) return 'https://api.iconify.design/lucide:tablet.svg?color=%2371717a';
	if (lower.includes('desktop')) return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';

	return 'https://api.iconify.design/lucide:monitor.svg?color=%2371717a';
};

export const getCountryFlag = (countryName: string | null) => {
	if (!countryName || countryName === 'Unknown') return undefined;
	const code = getCountryCode(countryName);
	if (!code) return undefined;
	return `https://flagsapi.com/${code}/flat/64.png`;
};

export const getRegionIcon = () => 'https://api.iconify.design/lucide:map.svg?color=%2371717a';
export const getCityIcon = () => 'https://api.iconify.design/lucide:map-pin.svg?color=%2371717a';
