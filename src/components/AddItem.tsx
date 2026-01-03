import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchMetadata } from '@/lib/metadata';
import { searchItems, type SearchResult, getSearchSuggestions, getHotProducts } from '@/lib/search';
import ItemName from './ItemName';
import SearchSuggestions from './SearchSuggestions';

interface AddItemProps {
  onLoadingChange: (isLoading: boolean) => void;
  isUnlocked: boolean;
  promptForPassword: () => void;
}

const AddItem = forwardRef<HTMLDivElement, AddItemProps>(({ onLoadingChange, isUnlocked, promptForPassword }, ref) => {
  const [activeTab, setActiveTab] = useState<'search' | 'link'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggestionSelected, setIsSuggestionSelected] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);
  const suggestionAbortController = useRef<AbortController | null>(null);

  // Link state
  const [link, setLink] = useState('');
  
  // Common form state (Manual overrides)
  const [manualTitle, setManualTitle] = useState('');
  const [manualImage, setManualImage] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualCurrency, setManualCurrency] = useState('AUD');
  const [manualRemarks, setManualRemarks] = useState('');
  const [showManualFields, setShowManualFields] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Report loading state to parent
  useEffect(() => {
    onLoadingChange(searching || loading);
  }, [searching, loading, onLoadingChange]);

  // Fetch search suggestions
  useEffect(() => {
    if (isSuggestionSelected || searchQuery.length < 1) {
      setShowSuggestions(false);
      return;
    }

    const handler = setTimeout(() => {
      suggestionAbortController.current?.abort();
      suggestionAbortController.current = new AbortController();
      const signal = suggestionAbortController.current.signal;

      getSearchSuggestions(searchQuery, signal).then(suggestions => {
        console.log('Received suggestions in component:', suggestions);
        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
      });
    }, 300); // Debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, isSuggestionSelected]);

  const resetForm = () => {
    setLink('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResult(null);
    setManualTitle('');
    setManualImage('');
    setManualPrice('');
    setManualCurrency('AUD');
    setManualRemarks('');
    setShowManualFields(false);
    setError('');
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setError('');
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setIsSuggestionSelected(true);
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    searchAbortController.current = new AbortController();
    const signal = searchAbortController.current.signal;

    setSearching(true);
    setSearchResults([]);
    setError('');

    try {
      const handleProgress = (result: SearchResult) => {
        setSearchResults(prevResults => {
            const existingIndex = prevResults.findIndex(r => r.url === result.url);
            if (existingIndex !== -1) {
                const updatedResults = [...prevResults];
                updatedResults[existingIndex] = result;
                return updatedResults;
            }
            return [...prevResults, result];
        });
      };

      const results = await searchItems(searchQuery, handleProgress, signal);
      
      if (results.length === 0) {
        setError('No results found. Try a different term or use the "Add Link" tab.');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setError('An unexpected error occurred during the search.');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result);
    // Pre-fill manual fields in case user wants to edit
    setManualTitle(result.title);
    setManualImage(result.image);
    setManualPrice(result.price ? result.price.amount.toString() : '0');
    setManualCurrency(result.price ? result.price.currency : 'AUD');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked) {
      promptForPassword();
      return;
    }
    if (manualTitle.trim() === '') {
      setError('Please provide a title.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'items'), {
        title: manualTitle,
        image: manualImage,
        price: {
          amount: manualPrice ? parseFloat(manualPrice) : 0,
          currency: manualCurrency,
        },
        link: activeTab === 'search' && selectedResult ? selectedResult.url : link,
        createdAt: serverTimestamp(),
        remarks: manualRemarks,
        favorite: false,
      });
      resetForm();
    } catch (err) {
      setError('Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (link.trim() === '') {
      setError('Please provide a link.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const metadata = await fetchMetadata(link);

      // Pre-fill form with fetched data
      setManualTitle(metadata.title || '');
      setManualImage(metadata.image || '');
      if (metadata.price) {
        setManualPrice(metadata.price.amount > 0 ? metadata.price.amount.toString() : '');
        setManualCurrency(metadata.price.currency || 'AUD');
      } else {
        setManualPrice('');
        setManualCurrency('AUD');
      }

      // Show the manual form for confirmation/editing
      setShowManualFields(true);

      if (!metadata.title) {
        setError('Could not fetch a title. Please enter item details manually.');
      }
      
    } catch (err) {
      setShowManualFields(true);
      setManualTitle(''); // Clear fields on error
      setManualImage('');
      setManualPrice('');
      setManualCurrency('AUD');
      setManualRemarks('');
      setError('Could not fetch item details. Please enter them manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative z-20 p-4 sm:p-8 bg-white rounded-3xl shadow-xl border-4 border-blue-300 transform hover:scale-101 transition-transform duration-300 mb-8 md:mb-12">
      <div className="flex flex-col sm:flex-row mb-4 sm:mb-6 rounded-t-2xl overflow-hidden shadow-inner animate-pop-in border-b-4 border-stone-200">
        <button
          className={`flex-1 py-2 sm:py-3 text-center text-lg sm:text-xl font-medium text-shadow-sm transition-all duration-300 ${activeTab === 'search' ? 'bg-blue-300 text-white shadow-xl' : 'bg-white text-stone-700 hover:bg-blue-100 hover:text-blue-700'}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 Search Item
        </button>
        <button
          className={`flex-1 py-2 sm:py-3 text-center text-lg sm:text-xl font-medium text-shadow-sm transition-all duration-300 ${activeTab === 'link' ? 'bg-blue-300 text-white shadow-xl' : 'bg-white text-stone-700 hover:bg-blue-100 hover:text-blue-700'}`}
          onClick={() => setActiveTab('link')}
        >
          🔗 Add Link
        </button>
      </div>

      {activeTab === 'search' ? (
        <>
          {!selectedResult ? (
            <form onSubmit={handleSearch} className="mb-6" noValidate>
              <div className="relative flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setIsSuggestionSelected(false);
                      setSearchQuery(e.target.value);
                    }}
                    onFocus={() => {
                      setIsSuggestionSelected(false);
                      if (searchQuery.length === 0) {
                        suggestionAbortController.current?.abort();
                        getHotProducts().then(suggestions => {
                          setSearchSuggestions(suggestions);
                          setShowSuggestions(true);
                        });
                      } else {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="e.g. Cozy Blanket"
                    className="w-full p-3 sm:p-4 rounded-full border-2 border-stone-300 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-stone-700 placeholder-stone-400 text-base sm:text-lg"
                  />
                   <SearchSuggestions
                    suggestions={searchSuggestions}
                    onSelect={handleSuggestionSelect}
                    show={showSuggestions}
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-blue-300 hover:bg-blue-400 text-white font-medium py-3 sm:py-4 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-shadow-sm text-base sm:text-lg"
                >
                  {searching ? 'Searching...' : 'Search!'}
                </button>
                {searching && (
                  <button
                    type="button"
                    onClick={() => {
                      searchAbortController.current?.abort();
                      setSearching(false);
                      setSearchResults([]);
                    }}
                    className="bg-red-400 hover:bg-red-500 text-white font-medium py-3 sm:py-4 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 text-shadow-sm text-base sm:text-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : null}

          {/* Search Results Grid */}
          <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${!selectedResult && searchResults.length > 0 ? 'grid-rows-[1fr] mb-6 sm:mb-8' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-sm"
                >
                  Clear Results 🧹
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-blue-200 rounded-2xl p-3 sm:p-4 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white flex flex-col items-center justify-between animate-pop-in"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    onClick={() => handleSelectResult(result)}
                  >
                    <img
                      src={result.image || '/placeholder-item-image.png'}
                      alt={result.title}
                      className="w-full h-28 sm:h-32 object-cover rounded-lg mb-2 sm:mb-3 shadow-sm border border-stone-200"
                    />
                    <ItemName name={result.title} className="text-sm sm:text-md font-medium text-stone-700 text-center mb-1 sm:mb-2 text-shadow-sm" />
                    <div className="flex justify-between items-center w-full text-center md:flex-col md:gap-2">
                      <span className="text-blue-400 font-medium text-xs sm:text-base text-shadow-sm">
                        {result.price && result.price.amount > 0 ? `${result.price.currency} $${result.price.amount.toFixed(2)}` : 'N/A'}
                      </span>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={result.url}
                        className="flex items-center gap-1.5 text-xs text-white bg-blue-300 hover:bg-blue-400 transition-colors px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md text-shadow-sm min-w-0"
                      >
                        <span className="truncate">{result.source}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Item Confirmation / Edit */}
          <div className={`transition-all duration-1000 ease-in-out overflow-hidden ${selectedResult ? 'max-h-[1000px]' : 'max-h-0'}`}>
            <form onSubmit={handleManualSubmit}>
              <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-blue-100 rounded-2xl shadow-inner flex flex-col sm:flex-row items-center gap-3 sm:gap-4 border-2 border-stone-200">
                <img src={manualImage || '/placeholder-item-image.png'} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl shadow-md border border-blue-200" />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-extrabold text-blue-700 text-lg sm:text-xl text-shadow-sm">Adding this treasure!</h3>
                  <p className="text-xs sm:text-sm text-stone-700 mb-2 sm:mb-3">Feel free to sprinkle some magic on the details below.</p>
                  <button
                    type="button"
                    onClick={() => setSelectedResult(null)}
                    className="text-xs sm:text-sm text-blue-500 hover:underline font-semibold text-shadow-sm"
                  >
                    Nah, I'll find another...
                  </button>
                </div>
              </div>

              <div className="mb-4 sm:mb-5">
                <label className="block text-stone-700 text-sm sm:text-md font-bold mb-1 sm:mb-2 text-shadow-sm">Sparkly Title</label>
                <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 sm:gap-5 mb-6 sm:mb-8">
                <div className="flex-1">
                  <label className="block text-stone-700 text-sm sm:text-md font-bold mb-1 sm:mb-2 text-shadow-sm">Dreamy Price</label>
                  <input type="number" step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
                </div>
                <div className="w-full md:w-1/3">
                    <label className="block text-stone-700 text-sm sm:text-md font-bold mb-1 sm:mb-2 text-shadow-sm">Currency</label>
                    <select
                        value={manualCurrency}
                        onChange={(e) => setManualCurrency(e.target.value as any)}
                        className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700"
                    >
                        <option value="AUD">AUD</option>
                        <option value="USD">USD</option>
                        <option value="MYR">MYR</option>
                        <option value="SGD">SGD</option>
                        <option value="NZD">NZD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="CAD">CAD</option>
                        <option value="JPY">JPY</option>
                        <option value="CNY">CNY</option>
                        <option value="HKD">HKD</option>
                    </select>
                </div>
              </div>

              <div className="mb-4 sm:mb-5">
                <label className="block text-stone-700 text-sm sm:text-md font-bold mb-1 sm:mb-2 text-shadow-sm">Remarks</label>
                <textarea value={manualRemarks} onChange={(e) => setManualRemarks(e.target.value)} placeholder="e.g. For birthdays, special occasions" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedResult(null)}
                  className="w-full sm:w-auto sm:flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-extrabold py-2 sm:py-3 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-base text-shadow-sm max-w-[240px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto sm:flex-1 bg-blue-300 hover:bg-blue-400 text-white font-extrabold py-2 sm:py-3 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-base text-shadow-sm max-w-[240px]"
                >
                  {loading ? 'Adding magic...' : 'Grant My Wish! ✨'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : (
        /* Link Tab Content */
        <div className="pt-4 mb-6">
          
          <div className={`transition-all -mt-5 duration-1000 ease-in-out overflow-hidden ${!showManualFields ? 'max-h-[1000px]' : 'max-h-0'}`}>
            <form onSubmit={handleLinkSubmit} className="flex flex-col sm:flex-row gap-4">
              <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://magical-shop.com/sparkle-item" className="flex-1 p-3 m-1 sm:p-4 rounded-full border-2 border-stone-300 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-stone-700 placeholder-stone-400 text-base sm:text-lg" />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-300 hover:bg-blue-400 text-white font-medium py-3 m-1 sm:py-4 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-shadow-sm text-base sm:text-lg"
              >
                {loading ? 'Adding...' : '+ Add'}
              </button>
            </form>
          </div>
          <div className={`transition-all duration-1000 ease-in-out overflow-hidden ${showManualFields ? 'max-h-[1000px]' : 'max-h-0'}`}>
            {/* Manual Fields Logic */}
            <form onSubmit={handleManualSubmit}>
              {manualImage && (
                <div className="mb-4 sm:mb-6 flex justify-center">
                  <img src={manualImage} alt="Item Preview" className="max-h-40 w-auto object-contain rounded-lg shadow-md border-2 border-stone-200" />
                </div>
              )}
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualTitle" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Sparkly Title</label>
                <input type="text" id="manualTitle" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Enter item title" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualPrice" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Dreamy Price (Optional)</label>
                <div className="flex gap-4">
                  <input
                    type="number"
                    id="manualPrice"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="border-2 border-stone-200 rounded-xl w-2/3 p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400"
                  />
                  <select
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value as any)}
                    className="border-2 border-stone-200 rounded-xl w-1/3 p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700"
                  >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                    <option value="MYR">MYR</option>
                    <option value="SGD">SGD</option>
                    <option value="NZD">NZD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="CAD">CAD</option>
                    <option value="JPY">JPY</option>
                    <option value="CNY">CNY</option>
                    <option value="HKD">HKD</option>
                  </select>
                </div>
              </div>
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualRemarks" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Remarks (Optional)</label>
                <textarea id="manualRemarks" value={manualRemarks} onChange={(e) => setManualRemarks(e.target.value)} placeholder="e.g. For birthdays, special occasions" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center mb-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto sm:flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-extrabold py-2 sm:py-3 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-base text-shadow-sm max-w-[240px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto sm:flex-1 bg-blue-300 hover:bg-blue-400 text-white font-extrabold py-2 sm:py-3 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-base text-shadow-sm max-w-[240px]"
                >
                  {loading ? 'Adding magic...' : 'Grant My Wish! ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`transition-all duration-1000 ease-in-out overflow-hidden ${error ? 'max-h-[200px] mt-5' : 'max-h-0'}`}>
        <p className="text-red-700 font-bold text-center bg-red-200 p-3 rounded-lg border-2 border-red-500 text-shadow-sm">{error}</p>
      </div>
    </div>
  );
});

export default AddItem;

