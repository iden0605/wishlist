import type { Metadata } from './metadata';
import { fetchMetadata } from './metadata';

export interface SearchResult extends Metadata {
  source: string;
  snippet?: string;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '';

// Domains to exclude from product search results
const NON_SHOPPING_DOMAINS = [
  // Social Media
  'reddit.com',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'linkedin.com',
  'snapchat.com',
  
  // Forums & Communities
  'quora.com',
  'stackoverflow.com',
  'stackexchange.com',
  'discourse.org',
  
  // Information Sites
  'wikipedia.org',
  'wikihow.com',
  'fandom.com',
  'imdb.com',
  
  // Blogs & Content Platforms
  'medium.com',
  'substack.com',
  'blogspot.com',
  'wordpress.com',
  'tumblr.com',
  'wix.com',
  'squarespace.com',
  
  // Developer Sites
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  
  // News Sites (optional - remove if you want product reviews from news sites)
  'cnn.com',
  'bbc.com',
  'nytimes.com',
  'theguardian.com',
  'washingtonpost.com',
  
  // Other
  'archive.org',
  'web.archive.org',
];

/**
 * Checks if a URL is from a non-shopping domain
 */
const isNonShoppingDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return NON_SHOPPING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    // If URL parsing fails, exclude it to be safe
    return true;
  }
};

/**
 * Checks if an item appears to be a product page
 */
const isProductLink = (item: any): boolean => {
  try {
    const url = new URL(item.link);
    const path = url.pathname.toLowerCase();
    
    // Check for product indicators in URL path
    const productPathIndicators = [
      '/product/', '/products/',
      '/item/', '/items/',
      '/p/',
      '/dp/', // Amazon
      '/buy/',
      '/shop/',
      '/store/',
      '-p-', // Some sites use this pattern
    ];
    
    const hasProductPath = productPathIndicators.some(indicator => 
      path.includes(indicator)
    );
    
    // Check for product metadata from Google's structured data
    const hasPrice = item.pagemap?.offer?.[0]?.price || 
                     item.pagemap?.metatags?.[0]?.['product:price:amount'] ||
                     item.pagemap?.metatags?.[0]?.['og:price:amount'];
    
    const hasProductSchema = item.pagemap?.product || 
                             item.pagemap?.offer;
    
    // Check if snippet contains price indicators
    const snippet = (item.snippet || '').toLowerCase();
    const hasPriceInSnippet = /\$\d+|\d+\.\d{2}|price:|buy now|add to cart|in stock/i.test(snippet);
    
    // Consider it a product link if it has any strong product indicators
    return hasProductPath || hasPrice || hasProductSchema || hasPriceInSnippet;
    
  } catch {
    return false;
  }
};

export const searchItems = async (
  query: string,
  onProgress?: (result: SearchResult) => void
): Promise<SearchResult[]> => {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured.');
  }

  try {
    // Step 1: Get search results from Google (increased to 10)
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' buy')}&num=10`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Filter out non-shopping domains first
    const shoppingItems = data.items.filter((item: any) => !isNonShoppingDomain(item.link));
    
    // Then filter to only include product links
    const productItems = shoppingItems.filter((item: any) => isProductLink(item));
    
    if (productItems.length === 0) {
      console.warn('No product links found after filtering');
      return [];
    }

    console.log(`Found ${productItems.length} product links out of ${data.items.length} total results`);

    // Step 2: Create initial results with basic info
    const initialResults: SearchResult[] = productItems.map((item: any) => {
      const hostname = new URL(item.link).hostname.replace('www.', '');
      
      // Try to get image from multiple sources
      let image = '';
      let price = 0;
      
      // Try to extract price from snippet or structured data
      if (item.pagemap?.offer?.[0]?.price) {
        price = parseFloat(item.pagemap.offer[0].price);
      } else if (item.pagemap?.metatags?.[0]?.['product:price:amount']) {
        price = parseFloat(item.pagemap.metatags[0]['product:price:amount']);
      } else if (item.pagemap?.metatags?.[0]?.['og:price:amount']) {
        price = parseFloat(item.pagemap.metatags[0]['og:price:amount']);
      }
      
      // Priority 1: Google's pagemap (often has product images)
      if (item.pagemap?.cse_image?.[0]?.src) {
        image = item.pagemap.cse_image[0].src;
      } 
      // Priority 2: OpenGraph image from pagemap
      else if (item.pagemap?.metatags?.[0]?.['og:image']) {
        image = item.pagemap.metatags[0]['og:image'];
      }
      // Priority 3: Any image from pagemap
      else if (item.pagemap?.cse_thumbnail?.[0]?.src) {
        image = item.pagemap.cse_thumbnail[0].src;
      }
      // Priority 4: Fallback to company logo
      else {
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

    // Step 3: Return initial results immediately for quick UI update
    if (onProgress) {
      initialResults.forEach(result => onProgress(result));
    }

    // Step 4: Fetch metadata in parallel to get better data (especially prices)
    const enrichedResults = await Promise.all(
      initialResults.map(async (result) => {
        try {
          const metadata = await fetchMetadata(result.url);
          
          // Create enriched result, preferring metadata when available
          const enrichedResult: SearchResult = {
            ...result,
            title: metadata.title || result.title,
            price: metadata.price || result.price,
            image: metadata.image || result.image,
          };
          
          // Notify progress for each completed fetch
          if (onProgress) {
            onProgress(enrichedResult);
          }
          
          return enrichedResult;
        } catch (error) {
          console.error(`Failed to fetch metadata for ${result.url}:`, error);
          // Return initial result if metadata fetch fails
          return result;
        }
      })
    );

    return enrichedResults;
    
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

// Helper function to extract price from text using regex
export const extractPriceFromText = (text: string): number => {
  // Match patterns like $99.99, $99, USD 99.99, 99.99 USD, etc.
  const pricePatterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,  // $99.99 or $1,299.99
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|usd)/,  // 99.99 USD
    /(?:USD|usd)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,  // USD 99.99
    /Price:\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,  // Price: $99.99
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Remove commas and parse as float
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }

  return 0;
};