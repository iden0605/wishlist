export type Currency = 'USD' | 'AUD' | 'MYR' | 'SGD' | 'NZD' | 'GBP' | 'EUR' | 'CAD' | 'JPY' | 'CNY' | 'HKD' | 'INR' | 'PHP' | 'THB' | 'IDR' | 'VND' | 'KRW' | 'TWD' | 'UNKNOWN';

export interface Price {
  amount: number;
  currency: Currency;
}

export interface CurrencyDetectionOptions {
  userLocation?: string;
  defaultCurrency?: Currency;
  sourceUrl?: string;
}

const API_URL = 'https://open.er-api.com/v6/latest/AUD';
const CACHE_KEY = 'currency_rates_cache';
const USER_CURRENCY_PREF_KEY = 'user_default_currency';
const CACHE_DURATION = 4 * 60 * 60 * 1000;

interface ExchangeRates {
  rates: Record<string, number>;
  time_last_update_unix: number;
}

interface CachedRates {
  rates: Record<string, number>;
  time_last_update_unix: number;
}

export const setDefaultCurrency = (currency: Currency): void => {
  localStorage.setItem(USER_CURRENCY_PREF_KEY, currency);
};

export const getDefaultCurrency = (): Currency | null => {
  const pref = localStorage.getItem(USER_CURRENCY_PREF_KEY);
  return pref as Currency | null;
};

async function getConversionRates(): Promise<Record<string, number>> {
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    const { rates, time_last_update_unix }: CachedRates = JSON.parse(cachedData);
    const age = Date.now() - (time_last_update_unix * 1000);
    if (age < CACHE_DURATION) {
      return rates;
    }
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    const data: ExchangeRates = await response.json();
    
    const ratesToAud: Record<string, number> = {};
    for (const currency in data.rates) {
      ratesToAud[currency] = 1 / data.rates[currency];
    }
    ratesToAud['AUD'] = 1;

    localStorage.setItem(CACHE_KEY, JSON.stringify({
        rates: ratesToAud,
        time_last_update_unix: data.time_last_update_unix,
    }));

    return ratesToAud;
  } catch (error) {
    console.error('Currency conversion API failed:', error);
    return { 'USD': 0.67, 'MYR': 0.21, 'AUD': 1 };
  }
}

export const convertToAud = async (price: Price): Promise<Price> => {
  if (price.currency === 'AUD' || price.currency === 'UNKNOWN' || price.amount === 0) {
    return price;
  }

  const rates = await getConversionRates();
  const rate = rates[price.currency];

  if (rate) {
    return {
      amount: price.amount * rate,
      currency: 'AUD',
    };
  }

  return { ...price, currency: 'UNKNOWN' };
};

export const formatPrice = (price: Price | null | undefined): string => {
  if (!price || price.amount <= 0) {
    return 'Price unknown!';
  }
  if (price.currency === 'AUD') {
    return `A$${price.amount.toFixed(2)}`;
  }
  return `${price.currency} $${price.amount.toFixed(2)}`;
};

export const detectCurrency = (
  text: string, 
  options?: CurrencyDetectionOptions
): Currency => {
  const s = text.toLowerCase();
  
  if (s.includes('myr') || s.includes('rm')) return 'MYR';
  if (s.includes('sgd') || s.includes('s$')) return 'SGD';
  if (s.includes('nzd') || s.includes('nz$')) return 'NZD';
  if (s.includes('gbp') || s.includes('£')) return 'GBP';
  if (s.includes('eur') || s.includes('€')) return 'EUR';
  if (s.includes('cad') || s.includes('c$')) return 'CAD';
  if (s.includes('jpy') || s.includes('¥') || s.includes('yen')) return 'JPY';
  if (s.includes('cny') || s.includes('yuan') || s.includes('rmb')) return 'CNY';
  if (s.includes('hkd') || s.includes('hk$')) return 'HKD';
  if (s.includes('inr') || s.includes('₹') || s.includes('rupee') || s.includes('rupees')) return 'INR';
  if (s.includes('php') || s.includes('₱') || s.includes('peso') || s.includes('pesos')) return 'PHP';
  if (s.includes('thb') || s.includes('฿') || s.includes('baht')) return 'THB';
  if (s.includes('idr') || s.includes('rupiah')) return 'IDR';
  if (s.includes('vnd') || s.includes('₫') || s.includes('dong')) return 'VND';
  if (s.includes('krw') || s.includes('₩') || s.includes('won')) return 'KRW';
  if (s.includes('twd') || s.includes('nt$')) return 'TWD';
  
  if (s.includes('aud') || s.includes('au$') || s.includes('a$') || s.includes('australian dollar')) return 'AUD';
  if (s.includes('usd') || s.includes('us$') || s.includes('us dollar')) return 'USD';
  
  if (s.includes('$')) {
    if (options?.sourceUrl) {
      const url = options.sourceUrl.toLowerCase();
      if (url.includes('.com.au')) return 'AUD';
      if (url.includes('.com.my')) return 'MYR';
      if (url.includes('.com.sg')) return 'SGD';
      if (url.includes('.co.nz')) return 'NZD';
      if (url.includes('.co.uk')) return 'GBP';
      if (url.includes('.com.hk')) return 'HKD';
      if (url.includes('.co.in') || url.includes('.in')) return 'INR';
      if (url.includes('.com.ph') || url.includes('.ph')) return 'PHP';
      if (url.includes('.co.th') || url.includes('.th')) return 'THB';
      if (url.includes('.co.id') || url.includes('.id')) return 'IDR';
      if (url.includes('.com.vn') || url.includes('.vn')) return 'VND';
      if (url.includes('.co.kr') || url.includes('.kr')) return 'KRW';
      if (url.includes('.com.tw') || url.includes('.tw')) return 'TWD';
      if (url.includes('.co.jp') || url.includes('.jp')) return 'JPY';
      if (url.includes('.cn')) return 'CNY';
    }
    
    if (options?.defaultCurrency) return options.defaultCurrency;
    
    if (options?.userLocation) {
      if (options.userLocation === 'AU') return 'AUD';
      if (options.userLocation === 'MY') return 'MYR';
      if (options.userLocation === 'SG') return 'SGD';
      if (options.userLocation === 'US') return 'USD';
      if (options.userLocation === 'GB' || options.userLocation === 'UK') return 'GBP';
      if (options.userLocation === 'HK') return 'HKD';
      if (options.userLocation === 'IN') return 'INR';
      if (options.userLocation === 'PH') return 'PHP';
      if (options.userLocation === 'TH') return 'THB';
      if (options.userLocation === 'ID') return 'IDR';
      if (options.userLocation === 'VN') return 'VND';
      if (options.userLocation === 'KR') return 'KRW';
      if (options.userLocation === 'TW') return 'TWD';
      if (options.userLocation === 'JP') return 'JPY';
      if (options.userLocation === 'CN') return 'CNY';
    }
    
    const userPref = getDefaultCurrency();
    if (userPref && userPref !== 'UNKNOWN') {
      return userPref;
    }
    
    return 'USD';
  }
  
  return 'UNKNOWN';
};