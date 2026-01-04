// search.ts - Enhanced version with Shopping results

import type { Metadata } from './metadata';
import { fetchMetadata } from './metadata';
import { type Price, detectCurrency } from './currency';

export interface SearchResult extends Metadata {
  source: string;
  snippet?: string;
  isShoppingResult?: boolean; // Flag to identify shopping results
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
  
  const hasProductPath = url.includes('/product') || url.includes('/item') || 
                         url.includes('/dp/') || url.includes('/p/') ||
                         url.includes('/buy') || url.includes('/shop');
  
  const hasPrice = item.pagemap?.offer?.[0]?.price || 
                   item.pagemap?.product ||
                   snippet.includes('$') || snippet.includes('price');
  
  return hasProductPath || hasPrice;
};

const anySignal = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), {
      once: true,
    });
  }
  return controller.signal;
};

const fetchWithTimeout = async (url: string, timeout = 8000, signal?: AbortSignal): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const abortSignal = signal ? anySignal([controller.signal, signal]) : controller.signal;

  try {
    const response = await fetch(url, { signal: abortSignal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const parsePriceAmount = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') return priceStr > 0 ? priceStr : 0;
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
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
};

const extractPriceFromText = (text: string): Price => {
    const currency = detectCurrency(text);
    const pricePatterns = [
        /(?:[\$€£¥]|RM|SGD|NZD|CAD|HKD|A\$|AU\$)\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
        /(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:USD|MYR|AUD|dollars?|SGD|NZD|GBP|EUR|CAD|JPY|CNY|HKD)/i,
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

// Check if URL is a valid product page (not a direct image/asset URL)
const isValidProductUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // Exclude direct image URLs
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    if (imageExtensions.some(ext => path.endsWith(ext))) {
      return false;
    }
    
    // Exclude CDN and asset URLs
    const excludedPatterns = [
      'cdn-images', 'cdn.', '/images/', '/assets/', 
      'static.', 'media.', '/thumb/', '/photo/',
      'cloudinary', 'imgix', 'akamaized'
    ];
    if (excludedPatterns.some(pattern => url.includes(pattern))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

// Fetch shopping results from Google Shopping API
const fetchShoppingResults = async (
  query: string,
  signal?: AbortSignal
): Promise<any[]> => {
  try {
    // Use the Shopping search type with Custom Search API
    const shoppingUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10`;
    
    const response = await fetchWithTimeout(shoppingUrl, 8000, signal);
    if (!response.ok) {
      console.warn('Shopping API request failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    // Filter and extract contextLink (the actual product page) instead of image URL
    const items = (data.items || []).map((item: any) => {
      // Prefer contextLink (the page containing the image) over link (direct image URL)
      const productUrl = item.image?.contextLink || item.link;
      
      return {
        ...item,
        link: productUrl, // Use the product page URL
        originalImageUrl: item.link, // Keep original image URL for reference
      };
    }).filter((item: any) => isValidProductUrl(item.link));
    
    return items;
  } catch (error) {
    console.error('Shopping search error:', error);
    return [];
  }
};

// Process a single item into SearchResult format
const processSearchItem = (item: any, isShoppingResult = false): SearchResult | null => {
  try {
    const hostname = new URL(item.link).hostname.replace('www.', '');
    
    let price: Price = { amount: 0, currency: 'UNKNOWN' };
    let image = '';
    
    // Extract price from Google's data (try multiple sources)
    const offer = item.pagemap?.offer?.[0];
    const metatags = item.pagemap?.metatags?.[0];
    const product = item.pagemap?.product?.[0];

    if (offer?.price) {
      const currency = detectCurrency(offer.priceCurrency || offer.price);
      const amount = parsePriceAmount(String(offer.price));
      if (amount > 0) {
        price = { amount, currency };
      }
    } else if (product?.price) {
      const currency = detectCurrency(product.priceCurrency || product.price);
      const amount = parsePriceAmount(String(product.price));
      if (amount > 0) {
        price = { amount, currency };
      }
    } else if (metatags?.['product:price:amount']) {
      const currency = detectCurrency(metatags['product:price:currency'] || '');
      const amount = parsePriceAmount(metatags['product:price:amount']);
      if (amount > 0) {
        price = { amount, currency: currency !== 'UNKNOWN' ? currency : 'USD' };
      }
    }
    
    // If still no price, try snippet and title
    if (price.amount === 0) {
      const textToSearch = `${item.snippet || ''} ${item.title || ''}`;
      price = extractPriceFromText(textToSearch);
    }
    
    // Get best image (prioritize high-quality images)
    image = item.pagemap?.metatags?.[0]?.['og:image'] ||
            item.pagemap?.cse_image?.[0]?.src ||
            item.image?.thumbnailLink ||
            item.pagemap?.cse_thumbnail?.[0]?.src ||
            (item.originalImageUrl && isValidProductUrl(item.originalImageUrl) ? '' : item.originalImageUrl) ||
            `https://logo.clearbit.com/${hostname}`;
    
    // Clean up title (remove site name suffix if present)
    let title = item.title || '';
    const commonSuffixes = [' - Farfetch', ' | Farfetch', ' - SSENSE', ' | SSENSE', ' - NET-A-PORTER', ' | Amazon'];
    for (const suffix of commonSuffixes) {
      if (title.endsWith(suffix)) {
        title = title.slice(0, -suffix.length).trim();
      }
    }
    
    return {
      title,
      url: item.link,
      snippet: item.snippet || '',
      source: hostname,
      price,
      image,
      isShoppingResult
    };
  } catch (error) {
    console.error('Error processing item:', error);
    return null;
  }
};

export const searchItems = async (
  query: string,
  onProgress?: (result: SearchResult) => void,
  signal?: AbortSignal
): Promise<SearchResult[]> => {
  // Check if the query is a URL
  try {
    const url = new URL(query);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const metadata = await fetchMetadata(query);
      return [{
        ...metadata,
        source: url.hostname.replace('www.', ''),
      }];
    }
  } catch (e) {
    // Not a URL, proceed with search
  }
  
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured.');
  }

  try {
    // Step 1: Fetch both regular and shopping results in parallel
    const [regularResponse, shoppingItems] = await Promise.all([
      fetchWithTimeout(
        `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' tangible product for sale')}&num=8`,
        8000,
        signal
      ),
      fetchShoppingResults(query, signal)
    ]);

    if (!regularResponse.ok) {
      throw new Error(`Search API returned ${regularResponse.status}`);
    }
    
    const regularData = await regularResponse.json();
    
    // Step 2: Process regular search results
    const regularItems = (regularData.items || [])
      .filter((item: any) => !isNonShoppingDomain(item.link))
      .filter((item: any) => isProductLink(item))
      .slice(0, 6);

    // Step 3: Process shopping results - filter out invalid URLs
    const processedShoppingItems = shoppingItems
      .filter((item: any) => !isNonShoppingDomain(item.link))
      .filter((item: any) => isValidProductUrl(item.link))
      .slice(0, 6);

    // Step 4: Combine and deduplicate results
    const allItems = [...regularItems, ...processedShoppingItems];
    const seenUrls = new Set<string>();
    const uniqueItems: any[] = [];

    for (const item of allItems) {
      const normalizedUrl = item.link.toLowerCase().replace(/\/$/, '');
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueItems.push(item);
      }
    }

    if (!uniqueItems.length) {
      return [];
    }

    // Step 5: Process all items into SearchResult format
    const initialResults: SearchResult[] = uniqueItems
      .map((item, index) => processSearchItem(
        item, 
        index >= regularItems.length // Mark as shopping result if from shopping API
      ))
      .filter((result): result is SearchResult => result !== null)
      .slice(0, 12); // Limit total results

    // Step 6: Return immediately for instant UI update
    if (onProgress) {
      initialResults.forEach(result => onProgress(result));
    }

    // Step 7: Enhance results in background
    const enhanceResults = async () => {
      // Only enhance items that need it AND have valid URLs
      const itemsToEnhance = initialResults.filter(r => 
        (!r.price.amount || !r.image) && isValidProductUrl(r.url)
      );
      
      await Promise.all(itemsToEnhance.map(async (result) => {
        const cached = metadataCache.get(result.url);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          const enhanced = { ...result, ...cached.data };
          if (onProgress) onProgress(enhanced);
          return;
        }
      
        try {
          const metadata = await fetchMetadata(result.url);
          
          // Only use fetched metadata if it's actually useful
          // (some sites return "Access Denied" or empty data)
          const hasUsefulData = metadata.title && 
                                metadata.title !== 'Access Denied' && 
                                metadata.title !== 'Denied' &&
                                !metadata.title.toLowerCase().includes('access denied') &&
                                (metadata.price.amount > 0 || metadata.image);
          
          if (hasUsefulData) {
            metadataCache.set(result.url, {
              data: metadata,
              timestamp: Date.now()
            });
            
            const enhanced: SearchResult = {
              ...result,
              title: metadata.title || result.title,
              price: metadata.price.amount ? metadata.price : result.price,
              image: metadata.image || result.image,
            };
            
            if (onProgress) onProgress(enhanced);
            
            const index = initialResults.findIndex(r => r.url === result.url);
            if (index !== -1) {
              initialResults[index] = enhanced;
            }
          } else {
            console.log(`Skipping unhelpful metadata for ${result.url}`);
          }
        } catch (error) {
          console.error(`Metadata fetch failed for ${result.url}:`, error);
          // Don't retry - keep the original Google data
        }
      }));
    };

    enhanceResults();

    return initialResults;
    
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

export const getSearchSuggestions = (
  query: string,
  signal?: AbortSignal
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    if (!query) {
      return resolve([]);
    }

    const callbackName = `jsonp_callback_${Math.round(100000 * Math.random())}`;
    const script = document.createElement('script');

    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    
    const cleanup = () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any)[callbackName];
      signal?.removeEventListener('abort', handleAbort);
    };

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      const suggestions = (data[1] || []).slice(0, 5);
      resolve(suggestions);
    };
    
    script.src = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to fetch suggestions.'));
    };

    if (signal?.aborted) {
      return handleAbort();
    }
    
    signal?.addEventListener('abort', handleAbort);
    
    document.body.appendChild(script);
  });
};

export const getHotProducts = (): Promise<string[]> => {
  const hotProducts = [
    'iPhone 17',
    'Hermes Kelly Bag',
    'PlayStation 6',
    'Dyson Supersonic Hair Dryer',
    'Lululemon Align Leggings',
    'Rimowa Classic Cabin Suitcase',
    'Leica M11 Camera',
    'Chanel No. 5 Perfume',
    'Nintendo Switch 2',
    'Gucci Horsebit Loafers',
  ];

  const shuffled = hotProducts.sort(() => 0.5 - Math.random());
  
  return Promise.resolve(shuffled.slice(0, 5));
};

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      metadataCache.delete(key);
    }
  }
}, 60000);