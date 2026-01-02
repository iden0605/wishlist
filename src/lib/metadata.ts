export interface Metadata {
  title: string;
  image: string;
  price: number;
  url: string;
}

// Reuse fetch with timeout from search.ts or implement here
const fetchWithTimeout = async (url: string, timeout = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const fetchMetadata = async (url: string): Promise<Metadata> => {
  let urlToFetch = url;
  if (!/^https?:\/\//i.test(url)) {
    urlToFetch = 'https://' + url;
  }

  // Simplified API call - only request essential data
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(urlToFetch)}&data.jsonld.selector=script[type="application/ld+json"]&data.jsonld.attr=text&data.ogPrice.selector=meta[property="product:price:amount"]&data.ogPrice.attr=content`;
  
  const response = await fetchWithTimeout(apiUrl, 5000); // 5 second timeout
  if (!response.ok) throw new Error('Failed to fetch metadata');
  
  const responseData = await response.json();
  const { data } = responseData;
  
  const title = data?.title || '';
  const image = data?.image?.url || '';
  let price = 0;
  
  // Fast price extraction - prioritize most reliable sources
  if (data.jsonld) {
    price = extractPriceFromJsonLd(data.jsonld);
  }
  
  if (price === 0 && data.ogPrice) {
    price = parsePrice(data.ogPrice);
  }

  return {
    title,
    image,
    price: (isNaN(price) || price <= 0) ? 0 : price,
    url: urlToFetch
  };
};

// Optimized JSON-LD parser
function extractPriceFromJsonLd(jsonld: any): number {
  try {
    let content = jsonld.text || jsonld;
    if (typeof content === 'string') {
      content = JSON.parse(content);
    }
    
    const items = Array.isArray(content) ? content : [content];
    
    for (const item of items) {
      if (item['@graph']) {
        const graphPrice = extractPriceFromJsonLd({ text: item['@graph'] });
        if (graphPrice > 0) return graphPrice;
      }

      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      const isProduct = types.some((t: string) => t?.toLowerCase().includes('product'));
      
      if (isProduct && item.offers) {
        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
        
        for (const offer of offers) {
          const priceValue = offer.price || offer.lowPrice;
          if (priceValue) {
            const parsed = parsePrice(priceValue);
            if (parsed > 0) return parsed;
          }
        }
      }
    }
  } catch {
    // Silently fail
  }
  return 0;
}

// Fast price parser
function parsePrice(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  
  const cleaned = String(priceStr).replace(/[^\d,.]/g, '');
  
  // Handle decimal separators
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    normalized = /,\d{2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  }
  
  const parsed = parseFloat(normalized);
  return (!isNaN(parsed) && parsed > 0) ? parsed : 0;
}