import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCategories } from '@/hooks/useCategories';

const AddItem = () => {
  const { categories } = useCategories();
  const [link, setLink] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualImage, setManualImage] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [showManualFields, setShowManualFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setLink('');
    setCategoryId('');
    setManualTitle('');
    setManualImage('');
    setManualPrice('');
    setShowManualFields(false);
    setError('');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTitle.trim() === '' || categoryId === '') {
      setError('Please provide a title and select a category.');
      return;
    }

    setLoading(true);
    await addDoc(collection(db, 'items'), {
      title: manualTitle,
      image: manualImage,
      price: manualPrice ? parseFloat(manualPrice) : 0,
      link,
      categoryId,
      createdAt: serverTimestamp(),
    });
    resetForm();
    setLoading(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (link.trim() === '' || categoryId === '') {
      setError('Please provide a link and select a category.');
      return;
    }

    let urlToFetch = link;
    if (!/^https?:\/\//i.test(link)) {
      urlToFetch = 'https://' + link;
    }

    try {
      new URL(urlToFetch);
    } catch (_) {
      setError('Please enter a valid URL.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // We use Microlink to efficiently extract metadata.
      // We specifically request 'data.jsonld' to parse structured product data.
      // We also add selectors for standard Open Graph price tags which some sites use.
      const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(urlToFetch)}&data.jsonld.selector=script[type="application/ld+json"]&data.jsonld.attr=text&data.ogPrice.selector=meta[property="product:price:amount"]&data.ogPrice.attr=content&data.ogPrice2.selector=meta[property="og:price:amount"]&data.ogPrice2.attr=content`);
      
      if (!response.ok) throw new Error('Failed to fetch the URL.');
      
      const responseData = await response.json();
      const { data } = responseData;
      
      // Basic Open Graph data
      const title = data?.title;
      const image = data?.image?.url;
      const description = data?.description;

      // Logic to find price in JSON-LD structured data
      let price = 0;
      
      // Console logs for debugging
      console.log('Full response:', responseData);

      // Strategy 1: Try JSON-LD
      if (data.jsonld) {
        try {
          let jsonldContent = data.jsonld.text || data.jsonld;
          if (typeof jsonldContent === 'string') {
             jsonldContent = JSON.parse(jsonldContent);
          }
          const dataArray = Array.isArray(jsonldContent) ? jsonldContent : [jsonldContent];
          const productData = dataArray.find((item: any) =>
            item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
          );

          if (productData && productData.offers) {
            const offer = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
            if (offer && offer.price) price = parseFloat(offer.price);
            else if (offer && offer.lowPrice) price = parseFloat(offer.lowPrice);
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      }

      // Strategy 2: Check Open Graph / Meta tags if JSON-LD failed
      if (price === 0) {
        if (data.ogPrice) price = parseFloat(data.ogPrice);
        else if (data.ogPrice2) price = parseFloat(data.ogPrice2);
      }

      // Strategy 3: Regex match in Description or Title (last resort)
      // Look for patterns like $123.45 or $ 123
      if (price === 0 && (description || title)) {
        const priceRegex = /\$\s?(\d{1,3}(,\d{3})*(\.\d{2})?)/;
        const textToSearch = `${title} ${description}`;
        const match = textToSearch.match(priceRegex);
        if (match && match[1]) {
           price = parseFloat(match[1].replace(/,/g, ''));
        }
      }

      if (!title) {
        setShowManualFields(true);
        setError('Could not automatically fetch item details. Please enter them manually.');
        return;
      }

      await addDoc(collection(db, 'items'), {
        title,
        image: image || '',
        price: isNaN(price) ? 0 : price,
        link,
        categoryId,
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
      <h2 className="text-2xl font-bold mb-6 text-gray-700">Add New Wishlist Item</h2>
      <form onSubmit={showManualFields ? handleManualSubmit : handleSubmit}>
        <div className="mb-6">
          <label htmlFor="link" className="flex items-center text-gray-700 text-sm font-bold mb-2">
            <span className="mr-2">🔗</span> Product Link
          </label>
          <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://example.com/product" className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500" />
        </div>
        <div className="mb-6">
          <label htmlFor="category" className="flex items-center text-gray-700 text-sm font-bold mb-2">
            <span className="mr-2">🏷️</span> Category
          </label>
          <div className="relative">
            <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500">
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
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
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
          <span className="mr-2">+</span> {loading ? 'Adding...' : 'Add Item'}
        </button>
      </form>
    </div>
  );
};

export default AddItem;