import { type Price, detectCurrency } from './currency';

export interface Metadata {
  title: string;
  image: string;
  price: Price;
  url: string;
}

const fetchWithTimeout = async (url: string, timeout = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
};

// Extract price from text
const extractPriceFromText = (text: string): Price => {
  const currency = detectCurrency(text);

  const pricePatterns = [
    /(?:[\$€£¥]|RM|SGD|NZD|CAD|HKD|A\$|AU\$)\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:USD|MYR|AUD|dollars?|SGD|NZD|GBP|EUR|CAD|JPY|CNY|HKD)/i,
    /price(?: is)?[:\s]+\$?(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/i
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const amount = parsePriceAmount(match[1]);
      if (amount > 0) {
        return { amount, currency: currency !== 'UNKNOWN' ? currency : 'USD' };
      }
    }
  }
  return { amount: 0, currency: 'UNKNOWN' };
};

// Clean title - remove site name and common suffixes
const cleanTitle = (title: string): string => {
  return title
    .replace(/\s*[-|:]\s*[^-|:]+$/, '')
    .trim();
};

// CORS proxies to try
const corsProxies = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Parse metadata from HTML
const parseMetadataFromHtml = (html: string, urlToFetch: string): Metadata => {
  // Parse title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || '';
  
  // Parse OG image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const image = ogImageMatch?.[1] || '';
  
  // Parse price from meta tags or structured data
  let price: Price = { amount: 0, currency: 'UNKNOWN' };
  
  // Try OG price
  const ogPriceAmountMatch = html.match(/<meta[^>]*property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([^"']+)["']/i);
  const ogPriceCurrencyMatch = html.match(/<meta[^>]*property=["'](?:product:price:currency|og:price:currency)["'][^>]*content=["']([^"']+)["']/i);

  if (ogPriceAmountMatch?.[1]) {
    const amount = parsePriceAmount(ogPriceAmountMatch[1]);
    if (amount > 0) {
      const currency = detectCurrency(ogPriceCurrencyMatch?.[1] || 'USD');
      price = { amount, currency };
    }
  }
  
  // Try JSON-LD
  if (price.amount === 0) {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi);
    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        const jsonMatch = script.match(/>([^<]+)</);
        if (jsonMatch?.[1]) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            const jsonPrice = extractPriceFromJsonLd(data);
            if (jsonPrice.amount > 0) {
              price = jsonPrice;
              break;
            }
          } catch {}
        }
      }
    }
  }
  
  // Fallback: search for price in HTML
  if (price.amount === 0) {
    price = extractPriceFromText(html);
  }
  
  if (!title) {
    throw new Error('Could not extract title from page');
  }
  
  return {
    title: cleanTitle(title),
    image,
    price,
    url: urlToFetch
  };
};

// Try fetching from a single proxy
const tryProxy = async (proxyUrl: string, proxyName: string): Promise<string> => {
  console.log(`🌐 Trying ${proxyName}...`);
  const response = await fetchWithTimeout(proxyUrl, 15000);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const html = await response.text();
  
  if (!html || html.length < 100) {
    throw new Error('Empty or invalid response');
  }
  
  console.log(`✅ ${proxyName} succeeded!`);
  return html;
};

// Main export function - parallel proxy racing
export const fetchMetadata = async (url: string): Promise<Metadata> => {
  let urlToFetch = url.trim();
  
  if (!/^https?:\/\//i.test(urlToFetch)) {
    urlToFetch = 'https://' + urlToFetch;
  }

  try {
    new URL(urlToFetch);
  } catch {
    throw new Error('Invalid URL format');
  }

  console.log('🔍 Fetching metadata for:', urlToFetch);

  // Create proxy attempts with AbortControllers for cancellation
  const controllers = corsProxies.map(() => new AbortController());
  
  const proxyPromises = corsProxies.map((proxyFn, index) => {
    const proxyUrl = proxyFn(urlToFetch);
    const proxyName = `Proxy ${index + 1}`;
    
    return tryProxy(proxyUrl, proxyName)
      .catch(error => {
        console.warn(`❌ ${proxyName} failed:`, error.message);
        throw error;
      });
  });

  try {
    // Race all proxies - first one to succeed wins!
    const html = await Promise.any(proxyPromises);
    
    // Cancel any remaining requests (they're still running)
    controllers.forEach(controller => controller.abort());
    
    // Parse and return metadata
    const result = parseMetadataFromHtml(html, urlToFetch);
    console.log('✅ Final result:', result);
    return result;
    
  } catch (error) {
    // All proxies failed
    if (error instanceof AggregateError) {
      console.error('❌ All proxies failed:', error.errors.map(e => e.message));
      throw new Error(`Could not fetch item details. All proxies failed.`);
    }
    throw new Error('Could not fetch item details from this URL');
  }
};

// Helper: Extract price from JSON-LD
function extractPriceFromJsonLd(jsonld: any): Price {
  try {
    let content = jsonld;
    
    if (typeof content === 'string') {
      content = JSON.parse(content);
    }
    
    const items = Array.isArray(content) ? content : [content];
    
    for (const item of items) {
      if (!item) continue;

      if (item['@graph']) {
        const graphPrice = extractPriceFromJsonLd(item['@graph']);
        if (graphPrice.amount > 0) return graphPrice;
      }

      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      const isProduct = types.some((t: string) =>
        t && typeof t === 'string' && t.toLowerCase().includes('product')
      );
      
      if (isProduct && item.offers) {
        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
        
        for (const offer of offers) {
          if (!offer) continue;
          
          const priceValue = offer.price || offer.lowPrice || offer.highPrice;
          const currency = detectCurrency(offer.priceCurrency || '');
          if (priceValue != null) {
            const amount = parsePriceAmount(priceValue);
            if (amount > 0) return { amount, currency };
          }
        }
      }

      if (isProduct && item.price) {
        const amount = parsePriceAmount(item.price);
        if (amount > 0) return { amount, currency: detectCurrency(item.priceCurrency || '') };
      }
    }
  } catch (e) {
    console.warn('JSON-LD parsing error:', e);
  }
  return { amount: 0, currency: 'UNKNOWN' };
}

// Helper: Parse price string/number
function parsePriceAmount(priceStr: string | number): number {
  if (typeof priceStr === 'number') {
    return priceStr > 0 ? priceStr : 0;
  }
  
  if (!priceStr) return 0;
  
  const cleaned = String(priceStr).replace(/[^\d.,]/g, '');
  
  if (!cleaned) return 0;
  
  let normalized = cleaned;
  
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = /,\d{2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  }
  
  const parsed = parseFloat(normalized);
  return (!isNaN(parsed) && parsed > 0) ? parsed : 0;
}