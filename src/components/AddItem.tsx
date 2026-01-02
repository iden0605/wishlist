import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchMetadata } from '@/lib/metadata';
import { searchItems, type SearchResult } from '@/lib/search';

const AddItem = () => {
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
    <div className="p-6 mb-8 bg-white rounded-xl shadow-lg">
      <div className="flex mb-6 border-b">
        <button
          className={`flex-1 pb-2 text-center font-bold ${activeTab === 'search' ? 'text-pink-500 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 Search Item
        </button>
        <button
          className={`flex-1 pb-2 text-center font-bold ${activeTab === 'link' ? 'text-pink-500 border-b-2 border-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('link')}
        >
          🔗 Add Link
        </button>
      </div>

      {activeTab === 'search' ? (
        <>
          {!selectedResult ? (
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Pink Mechanical Keyboard"
                  className="flex-1 shadow-sm appearance-none border rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {searching ? '...' : 'Go'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Search Results Grid */}
          {!selectedResult && searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {searchResults.map((result, idx) => (
                <div 
                  key={idx} 
                  className="border rounded-lg p-2 cursor-pointer hover:shadow-md transition-shadow hover:border-pink-300 bg-gray-50"
                  onClick={() => handleSelectResult(result)}
                >
                  <img 
                    src={result.image || 'https://via.placeholder.com/150'} 
                    alt={result.title} 
                    className="w-full h-24 object-cover rounded mb-2 bg-white" 
                  />
                  <h4 className="text-sm font-semibold truncate text-gray-800">{result.title}</h4>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-pink-600 font-bold text-xs">
                      {result.price ? `$${result.price.toFixed(2)}` : ''}
                    </span>
                    <span className="text-xs text-gray-500">{result.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Item Confirmation / Edit */}
          {selectedResult && (
             <form onSubmit={handleManualSubmit}>
               <div className="mb-4 p-4 bg-pink-50 rounded-lg flex items-start gap-4">
                 <img src={manualImage || 'https://via.placeholder.com/100'} className="w-16 h-16 object-cover rounded bg-white" />
                 <div className="flex-1">
                   <h3 className="font-bold text-gray-800">Add this item?</h3>
                   <p className="text-xs text-gray-500 mb-2">You can edit details below before adding.</p>
                   <button 
                     type="button" 
                     onClick={() => setSelectedResult(null)} 
                     className="text-xs text-red-500 hover:underline"
                   >
                     Cancel
                   </button>
                 </div>
               </div>

               <div className="mb-4">
                 <label className="block text-gray-700 text-sm font-bold mb-1">Title</label>
                 <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="border rounded w-full p-2" />
               </div>
               
               <div className="flex gap-4 mb-6">
                 <div className="flex-1">
                   <label className="block text-gray-700 text-sm font-bold mb-1">Price</label>
                   <input type="number" step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className="border rounded w-full p-2" />
                 </div>
                 <div className="flex-1">
                   <label className="block text-gray-700 text-sm font-bold mb-1">Image URL</label>
                   <input type="text" value={manualImage} onChange={(e) => setManualImage(e.target.value)} className="border rounded w-full p-2" />
                 </div>
               </div>

               <button type="submit" disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                 {loading ? 'Adding...' : 'Confirm & Add to Wishlist'}
               </button>
             </form>
          )}
        </>
      ) : (
        /* Original Link Form Logic */
        <form onSubmit={showManualFields ? handleManualSubmit : handleLinkSubmit}>
          <div className="mb-6">
            <label htmlFor="link" className="flex items-center text-gray-700 text-sm font-bold mb-2">
              <span className="mr-2">🔗</span> Product Link
            </label>
            <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://example.com/product" className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>

          {showManualFields && (
            <>
              <div className="mb-6">
                <label htmlFor="manualTitle" className="block text-gray-700 text-sm font-bold mb-2">Title</label>
                <input type="text" id="manualTitle" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Enter item title" className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div className="mb-6">
                <label htmlFor="manualImage" className="block text-gray-700 text-sm font-bold mb-2">Image URL (Optional)</label>
                <input type="text" id="manualImage" value={manualImage} onChange={(e) => setManualImage(e.target.value)} placeholder="https://example.com/image.png" className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div className="mb-6">
                <label htmlFor="manualPrice" className="block text-gray-700 text-sm font-bold mb-2">Price (Optional)</label>
                <input type="number" id="manualPrice" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.00" step="0.01" className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
            </>
          )}
          
          <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
            <span className="mr-2">+</span> {loading ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      )}

      {error && <p className="text-red-500 text-xs italic mt-4">{error}</p>}
    </div>
  );
};

export default AddItem;