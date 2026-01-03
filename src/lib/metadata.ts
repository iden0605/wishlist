export interface Metadata {
  title: string;
  image: string;
  price: number;
  url: string;
}

const fetchWithTimeout = async (url: string, timeout = 8000): Promise<Response> => {
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

// Extract price from text
const extractPriceFromText = (text: string): number => {
  const pricePatterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /RM\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|MYR|dollars?)/i,
    /price[:\s]+\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (price > 0) return price;
    }
  }
  return 0;
};

// Clean title - remove site name and common suffixes
const cleanTitle = (title: string): string => {
  return title
    .replace(/\s*[-|:]\s*[^-|:]+$/, '') // Remove " - Site Name" or " | Site Name"
    .trim();
};

// Main export function - direct scraping only
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

  try {
    // Use a CORS proxy to fetch the page
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlToFetch)}`;
    
    const response = await fetchWithTimeout(proxyUrl, 10000);
    if (!response.ok) {
      throw new Error(`Failed to fetch page (status ${response.status})`);
    }
    
    const html = await response.text();
    
    // Parse title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';
    
    // Parse OG image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const image = ogImageMatch?.[1] || '';
    
    // Parse price from meta tags or structured data
    let price = 0;
    
    // Try OG price
    const ogPriceMatch = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i);
    if (ogPriceMatch?.[1]) {
      price = parseFloat(ogPriceMatch[1]);
    }
    
    // Try JSON-LD
    if (price === 0) {
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi);
      if (jsonLdMatch) {
        for (const script of jsonLdMatch) {
          const jsonMatch = script.match(/>([^<]+)</);
          if (jsonMatch?.[1]) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              price = extractPriceFromJsonLd(data);
              if (price > 0) break;
            } catch {}
          }
        }
      }
    }
    
    // Fallback: search for price in HTML
    if (price === 0) {
      price = extractPriceFromText(html);
    }
    
    if (!title) {
      throw new Error('Could not extract title from page');
    }
    
    const result = {
      title: cleanTitle(title),
      image,
      price,
      url: urlToFetch
    };
    
    console.log('✅ Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Direct scrape failed:', error);
    throw new Error('Could not fetch item details from this URL');
  }
};

// Helper: Extract price from JSON-LD
function extractPriceFromJsonLd(jsonld: any): number {
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
        if (graphPrice > 0) return graphPrice;
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
          if (priceValue != null) {
            const parsed = parsePrice(priceValue);
            if (parsed > 0) return parsed;
          }
        }
      }

      if (isProduct && item.price) {
        const parsed = parsePrice(item.price);
        if (parsed > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn('JSON-LD parsing error:', e);
  }
  return 0;
}

// Helper: Parse price string/number
function parsePrice(priceStr: string | number): number {
  if (typeof priceStr === 'number') {
    return priceStr > 0 ? priceStr : 0;
  }
  
  if (!priceStr) return 0;
  
  const cleaned = String(priceStr)
    .replace(/[$£€¥₹RM]/gi, '')
    .replace(/\s/g, '')
    .trim();
  
  if (!cleaned) return 0;
  
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