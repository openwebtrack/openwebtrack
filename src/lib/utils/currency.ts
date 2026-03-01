const EXCHANGE_API = 'https://open.er-api.com/v6/latest';

let cachedRates: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000;

export async function fetchExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
	const now = Date.now();

	if (cachedRates && now - lastFetchTime < CACHE_DURATION && cachedRates['USD'] === 1) {
		return cachedRates;
	}

	try {
		const response = await fetch(`${EXCHANGE_API}/${baseCurrency}`);
		if (!response.ok) {
			throw new Error('Failed to fetch exchange rates');
		}
		const data = await response.json();
		if (data.result === 'success' && data.rates) {
			cachedRates = data.rates;
			lastFetchTime = now;
			return data.rates;
		}
		return cachedRates || getFallbackRates();
	} catch (error) {
		console.error('Error fetching exchange rates:', error);
		return cachedRates || getFallbackRates();
	}
}

function getFallbackRates(): Record<string, number> {
	return {
		USD: 1,
		AUD: 1.4072,
		BRL: 5.1556,
		CAD: 1.3671,
		CHF: 0.7712,
		CNY: 6.8582,
		CZK: 20.537,
		DKK: 6.3294,
		EUR: 0.8471,
		GBP: 0.74231,
		HKD: 7.8237,
		HUF: 319.04,
		IDR: 16801,
		ILS: 3.1433,
		INR: 91.08,
		ISK: 121.56,
		JPY: 155.98,
		KRW: 1441.97,
		MXN: 17.2122,
		MYR: 3.891,
		NOK: 9.4947,
		NZD: 1.6714,
		PHP: 57.683,
		PLN: 3.5784,
		RON: 4.3166,
		SEK: 9.0337,
		SGD: 1.2657,
		THB: 31.085,
		TRY: 43.96,
		ZAR: 15.9405
	};
}

export async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
	if (fromCurrency === toCurrency) {
		return amount;
	}

	const rates = await fetchExchangeRates(fromCurrency);
	const rate = rates[toCurrency];

	if (!rate) {
		return amount;
	}

	return amount * rate;
}

export function convertCurrencySync(amount: number, fromCurrency: string, toCurrency: string): number {
	if (fromCurrency === toCurrency) {
		return amount;
	}

	const rates = getFallbackRates();
	const rate = rates[toCurrency];

	if (!rate) {
		return amount;
	}

	return amount * rate;
}

export function getCurrencySymbol(currencyCode: string): string {
	const symbols: Record<string, string> = {
		USD: '$',
		EUR: '€',
		GBP: '£',
		JPY: '¥',
		CNY: '¥',
		INR: '₹',
		AUD: 'A$',
		CAD: 'C$',
		CHF: 'CHF',
		RON: 'lei',
		BRL: 'R$',
		MXN: 'MX$',
		KRW: '₩',
		SGD: 'S$',
		HKD: 'HK$',
		SEK: 'kr',
		NOK: 'kr',
		DKK: 'kr',
		NZD: 'NZ$',
		ZAR: 'R',
		TRY: '₺',
		PLN: 'zł',
		THB: '฿',
		IDR: 'Rp',
		MYR: 'RM',
		PHP: '₱',
		CZK: 'Kč',
		ILS: '₪',
		HUF: 'Ft',
		ISK: 'kr'
	};

	return symbols[currencyCode] || currencyCode;
}

export function formatCurrency(amount: number, currencyCode: string): string {
	const symbol = getCurrencySymbol(currencyCode);
	const isZeroDecimal = ['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'ISK'].includes(currencyCode);

	if (isZeroDecimal) {
		return `${symbol}${Math.round(amount).toLocaleString()}`;
	}

	return `${symbol}${(amount / 100).toFixed(2)}`;
}
