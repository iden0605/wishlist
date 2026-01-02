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
  const [showManualFields, setShowManualFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setLink('');
    setCategoryId('');
    setManualTitle('');
    setManualImage('');
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

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(link)}`);
      if (!response.ok) throw new Error('Failed to fetch the URL.');
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const getMetaTag = (type: string) => {
        const el = doc.querySelector(`meta[property="og:${type}"]`) || doc.querySelector(`meta[name="${type}"]`);
        return el?.getAttribute('content') || '';
      };

      const title = getMetaTag('title');
      const image = getMetaTag('image');

      if (!title) {
        setShowManualFields(true);
        setError('Could not automatically fetch item details. Please enter them manually.');
        return;
      }

      await addDoc(collection(db, 'items'), {
        title,
        image,
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
    <div className="p-4 mb-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Add New Wishlist Item</h2>
      <form onSubmit={showManualFields ? handleManualSubmit : handleSubmit}>
        <div className="mb-4">
          <label htmlFor="link" className="block text-gray-700 text-sm font-bold mb-2">Product Link</label>
          <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste product link here" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" />
        </div>
        <div className="mb-4">
          <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Category</label>
          <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700">
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        {showManualFields && (
          <>
            <div className="mb-4">
              <label htmlFor="manualTitle" className="block text-gray-700 text-sm font-bold mb-2">Title</label>
              <input type="text" id="manualTitle" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Enter item title" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" />
            </div>
            <div className="mb-4">
              <label htmlFor="manualImage" className="block text-gray-700 text-sm font-bold mb-2">Image URL (Optional)</label>
              <input type="text" id="manualImage" value={manualImage} onChange={(e) => setManualImage(e.target.value)} placeholder="Enter image URL" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" />
            </div>
          </>
        )}
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <button type="submit" disabled={loading} className="bg-pink-500 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded">
          {loading ? 'Adding...' : 'Add Item'}
        </button>
      </form>
    </div>
  );
};

export default AddItem;