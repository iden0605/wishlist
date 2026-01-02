import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchMetadata } from '@/lib/metadata';
import { searchItems, type SearchResult } from '@/lib/search';

interface AddItemProps {
  onLoadingChange: (isLoading: boolean) => void;
}

const AddItem: React.FC<AddItemProps> = ({ onLoadingChange }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'link'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Link state
  const [link, setLink] = useState('');
  
  // Common form state (Manual overrides)
  const [manualTitle, setManualTitle] = useState('');
  const [manualImage, setManualImage] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [showManualFields, setShowManualFields] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Report loading state to parent
  useEffect(() => {
    onLoadingChange(searching || loading);
  }, [searching, loading, onLoadingChange]);

  const resetForm = () => {
    setLink('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResult(null);
    setManualTitle('');
    setManualImage('');
    setManualPrice('');
    setShowManualFields(false);
    setError('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setSearchResults([]);
    setError('');
    
    const results = await searchItems(searchQuery);
    if (results.length === 0) {
      setError('No results found. Try a different term or use the "Add Link" tab.');
    }
    setSearchResults(results);
    setSearching(false);
  };

  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result);
    // Pre-fill manual fields in case user wants to edit
    setManualTitle(result.title);
    setManualImage(result.image);
    setManualPrice(result.price.toString());
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTitle.trim() === '') {
      setError('Please provide a title.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'items'), {
        title: manualTitle,
        image: manualImage,
        price: manualPrice ? parseFloat(manualPrice) : 0,
        link: activeTab === 'search' && selectedResult ? selectedResult.url : link,
        createdAt: serverTimestamp(),
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
      
      if (!metadata.title) {
        setShowManualFields(true);
        setError('Could not automatically fetch item details. Please enter them manually.');
        setManualTitle(''); // Clear incase of previous
        setManualImage('');
        setManualPrice('');
        return;
      }

      await addDoc(collection(db, 'items'), {
        title: metadata.title,
        image: metadata.image,
        price: metadata.price,
        link: metadata.url,
        createdAt: serverTimestamp(),
      });
      resetForm();
    } catch (err) {
      setShowManualFields(true);
      setError('Could not fetch item details. Please enter them manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-white rounded-3xl shadow-xl border-4 border-blue-300 transform hover:scale-105 transition-transform duration-300">
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
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Cozy Blanket"
                  className="flex-1 p-3 sm:p-4 rounded-full border-2 border-stone-300 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-stone-700 placeholder-stone-400 text-base sm:text-lg"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-blue-300 hover:bg-blue-400 text-white font-medium py-2 sm:py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-shadow-sm"
                >
                  {searching ? 'Searching...' : 'Search!'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Search Results Grid */}
          {!selectedResult && searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 animate-pop-in">
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="border-2 border-blue-200 rounded-2xl p-3 sm:p-4 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white flex flex-col items-center justify-between animate-pop-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                  onClick={() => handleSelectResult(result)}
                >
                  <img
                    src={result.image || 'https://via.placeholder.com/150/E0F2F7/4A4A4A?text=No+Image'}
                    alt={result.title}
                    className="w-full h-28 sm:h-32 object-cover rounded-lg mb-2 sm:mb-3 shadow-sm border border-stone-200"
                  />
                  <h4 className="text-sm sm:text-md font-medium text-stone-700 text-center mb-1 sm:mb-2 text-shadow-sm">{result.title}</h4>
                  <div className="flex justify-between items-center w-full text-center">
                    <span className="text-blue-400 font-medium text-xs sm:text-base text-shadow-sm">
                      {result.price ? `$${result.price.toFixed(2)}` : 'N/A'}
                    </span>
                    <span className="text-xs text-white bg-blue-300 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md text-shadow-sm">{result.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Item Confirmation / Edit */}
          {selectedResult && (
             <form onSubmit={handleManualSubmit} className="animate-pop-in">
               <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-blue-100 rounded-2xl shadow-inner flex flex-col sm:flex-row items-center gap-3 sm:gap-4 border-2 border-stone-200">
                 <img src={manualImage || 'https://via.placeholder.com/100/E0F2F7/4A4A4A?text=Item'} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl shadow-md border border-blue-200" />
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
                 <div className="flex-1">
                   <label className="block text-stone-700 text-sm sm:text-md font-bold mb-1 sm:mb-2 text-shadow-sm">Enchanting Image URL</label>
                   <input type="text" value={manualImage} onChange={(e) => setManualImage(e.target.value)} className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
                 </div>
               </div>

               <button type="submit" disabled={loading} className="w-full bg-blue-300 hover:bg-blue-400 text-white font-extrabold py-3 sm:py-4 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-lg text-shadow-sm">
                 {loading ? 'Adding magic...' : 'Grant My Wish! ✨'}
               </button>
             </form>
          )}
        </>
      ) : (
        /* Link Tab Content */
        <div className="mb-6">
          
          {!showManualFields ? (
            <form onSubmit={handleLinkSubmit} className="flex flex-col sm:flex-row gap-2">
              <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://magical-shop.com/sparkle-item" className="flex-1 p-3 sm:p-4 rounded-full border-2 border-stone-300 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg text-stone-700 placeholder-stone-400 text-base sm:text-lg" />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-300 hover:bg-blue-400 text-white font-medium py-2 sm:py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-shadow-sm"
              >
                {loading ? 'Adding...' : '+ Add'}
              </button>
            </form>
          ) : (
            /* Manual Fields Logic */
            <form onSubmit={handleManualSubmit}>
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualTitle" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Sparkly Title</label>
                <input type="text" id="manualTitle" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Enter item title" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualImage" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Enchanting Image URL (Optional)</label>
                <input type="text" id="manualImage" value={manualImage} onChange={(e) => setManualImage(e.target.value)} placeholder="https://magical-shop.com/image.png" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              <div className="mb-4 sm:mb-6">
                <label htmlFor="manualPrice" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">Dreamy Price (Optional)</label>
                <input type="number" id="manualPrice" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.00" step="0.01" className="border-2 border-stone-200 rounded-xl w-full p-2 sm:p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 text-stone-700 placeholder-stone-400" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-300 hover:bg-blue-400 text-white font-extrabold py-3 sm:py-4 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed text-lg text-shadow-sm">
                {loading ? 'Adding magic...' : 'Grant My Wish! ✨'}
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-red-700 font-bold text-center mt-5 bg-red-200 p-3 rounded-lg border-2 border-red-500 animate-bounce animate-wiggle text-shadow-sm">{error}</p>}
    </div>
  );
};

export default AddItem;