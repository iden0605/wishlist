// search.ts - Optimized version

import type { Metadata } from './metadata';
import { fetchMetadata } from './metadata';

// metadata.ts - Optimized version

export interface SearchResult extends Metadata {
  source: string;
  snippet?: string;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '';

const NON_SHOPPING_DOMAINS = [
  'reddit.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'pinterest.com', 'quora.com',
  'stackoverflow.com', 'wikipedia.org', 'wikihow.com', 'medium.com',
  'github.com', 'gitlab.com'
];

// Cache for recently fetched metadata (expires after 5 minutes)
const metadataCache = new Map<string, { data: Metadata; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isNonShoppingDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return NON_SHOPPING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return true;
  }
};

const isProductLink = (item: any): boolean => {
  const url = item.link.toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  
  // Quick checks first (faster than regex)
  const hasProductPath = url.includes('/product') || url.includes('/item') || 
                         url.includes('/dp/') || url.includes('/p/') ||
                         url.includes('/buy') || url.includes('/shop');
  
  const hasPrice = item.pagemap?.offer?.[0]?.price || 
                   item.pagemap?.product ||
                   snippet.includes('$') || snippet.includes('price');
  
  return hasProductPath || hasPrice;
};

// Fetch with timeout to prevent hanging requests
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

// Extract price with improved patterns
const extractPriceFromText = (text: string): number => {
  const pricePatterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /RM\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|MYR)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }
  return 0;
};

export const searchItems = async (
  query: string,
  onProgress?: (result: SearchResult) => void
): Promise<SearchResult[]> => {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured.');
  }

  try {
    // Step 1: Fetch search results (reduced to 8 for speed)
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' buy price')}&num=8`;
    
    const response = await fetchWithTimeout(searchUrl);
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items?.length) {
      return [];
    }

    // Step 2: Filter quickly (synchronous operations)
    const productItems = data.items
      .filter((item: any) => !isNonShoppingDomain(item.link))
      .filter((item: any) => isProductLink(item))
      .slice(0, 6); // Limit to top 6 results

    if (!productItems.length) {
      return [];
    }

    // Step 3: Create initial results with best available data from Google
    const initialResults: SearchResult[] = productItems.map((item: any) => {
      const hostname = new URL(item.link).hostname.replace('www.', '');
      
      let price = 0;
      let image = '';
      
      // Extract price from Google's data (fast)
      if (item.pagemap?.offer?.[0]?.price) {
        price = parseFloat(String(item.pagemap.offer[0].price).replace(/[^\d.]/g, ''));
      } else if (item.pagemap?.metatags?.[0]?.['product:price:amount']) {
        price = parseFloat(item.pagemap.metatags[0]['product:price:amount']);
      } else {
        // Fallback: extract from snippet
        price = extractPriceFromText(item.snippet || '');
      }
      
      // Get best image (fast)
      image = item.pagemap?.cse_image?.[0]?.src ||
              item.pagemap?.metatags?.[0]?.['og:image'] ||
              item.pagemap?.cse_thumbnail?.[0]?.src ||
              `https://logo.clearbit.com/${hostname}`;
      
      return {
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        source: hostname,
        price,
        image
      };
    });

    // Step 4: Return immediately for instant UI update
    if (onProgress) {
      initialResults.forEach(result => onProgress(result));
    }

    // Step 5: Enhance results in background (parallel, with limits)
    const enhanceResults = async () => {
      // Process only items missing price or image
      const itemsToEnhance = initialResults.filter(r => !r.price || !r.image);
      
      // Limit concurrent requests to 3 to avoid overwhelming the API
      const batchSize = 3;
      for (let i = 0; i < itemsToEnhance.length; i += batchSize) {
        const batch = itemsToEnhance.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (result) => {
            // Check cache first
            const cached = metadataCache.get(result.url);
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
              const enhanced = { ...result, ...cached.data };
              if (onProgress) onProgress(enhanced);
              return;
            }

            try {
              const metadata = await fetchMetadata(result.url);
              
              // Cache the result
              metadataCache.set(result.url, {
                data: metadata,
                timestamp: Date.now()
              });
              
              const enhanced: SearchResult = {
                ...result,
                title: metadata.title || result.title,
                price: metadata.price || result.price,
                image: metadata.image || result.image,
              };
              
              if (onProgress) onProgress(enhanced);
              
              // Update the original array
              const index = initialResults.findIndex(r => r.url === result.url);
              if (index !== -1) {
                initialResults[index] = enhanced;
              }
            } catch (error) {
              console.error(`Metadata fetch failed for ${result.url}:`, error);
            }
          })
        );
      }
    };

    // Run enhancement in background without blocking
    enhanceResults();

    return initialResults;
    
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      metadataCache.delete(key);
    }
  }
}, 60000); // Run every minute