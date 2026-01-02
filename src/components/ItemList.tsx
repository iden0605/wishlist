import React, { useState } from 'react';
import { useItems, type SortByType } from '@/hooks/useItems';
import { doc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ItemListProps {
  sortBy: SortByType;
}

const ItemList: React.FC<ItemListProps> = ({ sortBy }) => {
  const { items, loading } = useItems(sortBy);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async (id: string) => {
    const itemDoc = doc(db, 'items', id);
    await deleteDoc(itemDoc);
  };

  const handleClearAll = async () => {
    const itemsCollection = collection(db, 'items');
    const itemsSnapshot = await getDocs(itemsCollection);
    const batch = writeBatch(db);
    itemsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    setShowConfirm(false);
  };

  if (loading) {
    return <p className="text-center text-gray-500">Loading items...</p>;
  }

  return (
    <div>
      <div className="flex justify-end mb-4 items-center">
        <button onClick={() => setShowConfirm(true)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">Clear All</button>
      </div>

      {items.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl shadow-md">
          <h3 className="text-2xl font-semibold text-gray-700">Your Wishlist Awaits!</h3>
          <p className="text-gray-500 mt-4">Looks a bit empty in here. Why not add your first item and start filling it up?</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 group relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-red-500 text-gray-600 hover:text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 backdrop-blur-sm"
                title="Delete item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                <img src={item.image || 'https://via.placeholder.com/400x300'} alt={item.title} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 truncate">{item.title}</h3>
                  <p className="text-pink-500 font-bold mt-2">
                    {item.price ? `$${item.price.toFixed(2)}` : 'Price not available'}
                  </p>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Are you sure you want to delete all items?</h3>
            <div className="flex justify-end">
              <button onClick={() => setShowConfirm(false)} className="mr-4 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleClearAll} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemList;