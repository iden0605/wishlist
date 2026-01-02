export interface Metadata {
  title: string;
  image: string;
  price: number;
  url: string;
}

export const fetchMetadata = async (url: string): Promise<Metadata> => {
  let urlToFetch = url;
  if (!/^https?:\/\//i.test(url)) {
    urlToFetch = 'https://' + url;
  }

  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(urlToFetch)}&data.jsonld.selector=script[type="application/ld+json"]&data.jsonld.attr=text&data.ogPrice.selector=meta[property="product:price:amount"]&data.ogPrice.attr=content&data.ogPrice2.selector=meta[property="og:price:amount"]&data.ogPrice2.attr=content&data.twitterPrice.selector=meta[name="twitter:data1"]&data.twitterPrice.attr=content&data.priceSpan.selector=.price,.product-price,[itemprop="price"]&data.priceSpan.attr=text`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error('Failed to fetch the URL.');
  
  const responseData = await response.json();
  const { data } = responseData;
  
  const title = data?.title || '';
  const image = data?.image?.url || '';
  const description = data?.description || '';

  let price = 0;
  
  // Strategy 1: JSON-LD (most reliable for e-commerce)
  if (data.jsonld && price === 0) {
    price = extractPriceFromJsonLd(data.jsonld);
  }

  // Strategy 2: Open Graph meta tags
  if (price === 0) {
    price = extractPriceFromOG(data);
  }

  // Strategy 3: Twitter meta tags
  if (price === 0 && data.twitterPrice) {
    price = parsePrice(data.twitterPrice);
  }

  // Strategy 4: Price-specific HTML elements
  if (price === 0 && data.priceSpan) {
    price = parsePrice(data.priceSpan);
  }

  // Strategy 5: Regex from title/description (least reliable, last resort)
  if (price === 0 && (description || title)) {
    price = extractPriceFromText(`${title} ${description}`);
  }

  return {
    title,
    image,
    price: (isNaN(price) || price <= 0) ? 0 : price,
    url: urlToFetch
  };
};

// Extract price from JSON-LD structured data
function extractPriceFromJsonLd(jsonld: any): number {
  try {
    let jsonldContent = jsonld.text || jsonld;
    if (typeof jsonldContent === 'string') {
      jsonldContent = JSON.parse(jsonldContent);
    }
    const dataArray = Array.isArray(jsonldContent) ? jsonldContent : [jsonldContent];
    
    for (const item of dataArray) {
      // Handle @graph structure (common in WordPress)
      if (item['@graph']) {
        const graphPrice = extractPriceFromJsonLd({ text: item['@graph'] });
        if (graphPrice > 0) return graphPrice;
      }

      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      const isProduct = types.some((t: string) => 
        t?.toLowerCase().includes('product')
      );
      
      if (isProduct && item.offers) {
        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
        
        for (const offer of offers) {
          // Check multiple price fields
          const priceValue = offer.price || offer.lowPrice || offer.highPrice;
          if (priceValue) {
            const parsed = parsePrice(priceValue);
            if (parsed > 0) return parsed;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing JSON-LD:', e);
  }
  return 0;
}

// Extract price from Open Graph meta tags
function extractPriceFromOG(data: any): number {
  const ogPrice = data.ogPrice || data.ogPrice2;
  if (ogPrice) {
    const parsed = parsePrice(ogPrice);
    if (parsed > 0) return parsed;
  }
  return 0;
}

// Extract price from text using regex patterns
function extractPriceFromText(text: string): number {
  // More comprehensive regex patterns
  const patterns = [
    // Currency symbols followed by numbers: $99.99, €99,99, £99.99
    /[$€£¥₹]\s?(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)/,
    // Numbers followed by currency codes: 99.99 USD, 99.99 MYR, 99,99 EUR
    /(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)\s?(?:USD|EUR|GBP|MYR|AUD|SGD|CAD|NZD|JPY|CNY|INR)/i,
    // Currency codes followed by numbers: USD 99.99, MYR 99.99
    /(?:USD|EUR|GBP|MYR|AUD|SGD|CAD|NZD|JPY|CNY|INR)\s?(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)/i,
    // RM prefix (Malaysian Ringgit): RM99.99, RM 99.99
    /RM\s?(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)/i,
    // Price: label patterns: Price: $99.99, Price: 99.99
    /price:?\s?[$€£¥₹]?\s?(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = parsePrice(match[1]);
      if (parsed > 0) return parsed;
    }
  }
  
  return 0;
}

// Parse price string to number
function parsePrice(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  
  // Remove currency symbols and letters, keep numbers, commas, dots, spaces
  const cleaned = String(priceStr)
    .replace(/[^\d,.\s]/g, '')
    .trim();
  
  // Handle different decimal separators
  // European format: 1.234,56 -> 1234.56
  // US format: 1,234.56 -> 1234.56
  let normalized = cleaned;
  
  // If both comma and dot present, determine which is decimal separator
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // If comma comes after dot, comma is decimal: 1.234,56
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot comes after comma, dot is decimal: 1,234.56
      normalized = cleaned.replace(/,/g, '');
    }
  } 
  // Only comma present
  else if (cleaned.includes(',')) {
    // If comma is followed by exactly 2 digits at end, it's decimal: 99,99
    if (/,\d{2}$/.test(cleaned)) {
      normalized = cleaned.replace(',', '.');
    } else {
      // Otherwise it's thousands separator: 1,234
      normalized = cleaned.replace(/,/g, '');
    }
  }
  
  // Remove any remaining spaces
  normalized = normalized.replace(/\s/g, '');
  
  const parsed = parseFloat(normalized);
  return (!isNaN(parsed) && parsed > 0) ? parsed : 0;
}

// Search interface and function
export interface SearchResult extends Metadata {
  source: string;
  snippet?: string;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '';

export const searchItems = async (
  query: string,
  onProgress?: (result: SearchResult) => void
): Promise<SearchResult[]> => {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured.');
  }

  try {
    // Step 1: Get search results from Google
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' buy')}&num=6`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Step 2: Create initial results with basic info
    const initialResults: SearchResult[] = data.items.map((item: any) => {
      const hostname = new URL(item.link).hostname.replace('www.', '');
      
      let image = '';
      let price = 0;
      
      // Try to extract price from Google's structured data
      if (item.pagemap?.offer?.[0]?.price) {
        price = parsePrice(item.pagemap.offer[0].price);
      } else if (item.pagemap?.metatags?.[0]?.['product:price:amount']) {
        price = parsePrice(item.pagemap.metatags[0]['product:price:amount']);
      }
      
      // Get best available image
      if (item.pagemap?.cse_image?.[0]?.src) {
        image = item.pagemap.cse_image[0].src;
      } else if (item.pagemap?.metatags?.[0]?.['og:image']) {
        image = item.pagemap.metatags[0]['og:image'];
      } else if (item.pagemap?.cse_thumbnail?.[0]?.src) {
        image = item.pagemap.cse_thumbnail[0].src;
      } else {
        image = `https://logo.clearbit.com/${hostname}`;
      }
      
      return {
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        source: hostname,
        price,
        image
      };
    });

    // Step 3: Fetch metadata in background (don't await!)
    if (onProgress) {
      initialResults.forEach(async (result) => {
        try {
          const metadata = await fetchMetadata(result.url);
          
          const enrichedResult: SearchResult = {
            ...result,
            title: metadata.title || result.title,
            price: metadata.price || result.price,
            image: metadata.image || result.image,
          };
          
          onProgress(enrichedResult);
        } catch (error) {
          console.error(`Failed to fetch metadata for ${result.url}:`, error);
        }
      });
    }

    // Step 4: Return initial results immediately (fast!)
    return initialResults;
    
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};