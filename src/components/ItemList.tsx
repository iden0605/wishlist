import { useState, forwardRef } from 'react';
import { type Item } from '@/hooks/useItems';
import { doc, deleteDoc, collection, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { FaPencilAlt, FaHeart } from 'react-icons/fa';
import { db } from '@/lib/firebase';
import ItemName from './ItemName';
import PriceDisplay from './PriceDisplay';
import CollapsibleRemark from './CollapsibleRemark';

interface ItemListProps {
  items: Item[];
  loading: boolean;
  isUnlocked: boolean;
  promptForPassword: () => void;
  conciseMode: boolean;
}

const ItemList = forwardRef<HTMLDivElement, ItemListProps>(({ items, loading, isUnlocked, promptForPassword, conciseMode }, ref) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const handleDelete = async (id:string) => {
    if (!isUnlocked) {
      promptForPassword();
      return;
    }
    const itemDoc = doc(db, 'items', id);
    await deleteDoc(itemDoc);
  };

  const confirmDeleteItem = () => {
    if (itemToDelete) {
      handleDelete(itemToDelete);
      setItemToDelete(null);
    }
  };

  const handleFavoriteToggle = async (id: string, currentStatus: boolean) => {
    if (!isUnlocked) {
      promptForPassword();
      return;
    }
    const itemDoc = doc(db, 'items', id);
    await updateDoc(itemDoc, {
      favorite: !currentStatus,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isUnlocked || !editingItem) {
      promptForPassword();
      return;
    }

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      title: formData.get('title') as string,
      price: {
        amount: parseFloat((formData.get('price') as string) || '0'),
        currency: (formData.get('currency') as string) || 'AUD',
      },
      remarks: formData.get('remarks') as string,
    };

    const itemDoc = doc(db, 'items', editingItem.id);
    await updateDoc(itemDoc, updatedData);

    setEditingItem(null);
  };

  const handleClearAll = async () => {
    if (!isUnlocked) {
      promptForPassword();
      setShowConfirm(false);
      setShowFinalConfirm(false);
      return;
    }
    const itemsCollection = collection(db, 'items');
    const itemsSnapshot = await getDocs(itemsCollection);
    const batch = writeBatch(db);
    itemsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    setShowConfirm(false);
    setShowFinalConfirm(false);
  };

  if (loading) {
    return <p className="text-center text-stone-700 text-xl font-semibold mt-8 animate-pulse text-shadow-sm">Summoning items from the cozy ether... ✨</p>;
  }

  return (
    <div> {/* Outer div without ref */}
      <div className="flex justify-end mb-4 items-center">
        {isUnlocked && (
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-blue-300 hover:bg-blue-400 text-white font-semibold py-2 px-4 sm:py-3 sm:px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-shadow-sm text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={items.length === 0}
          >
            Clear All Wishes 🧹
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div ref={ref} className="text-center p-8 sm:p-12 bg-white rounded-3xl shadow-xl border-4 border-stone-200 animate-pop-in">
          <h3 className="text-2xl sm:text-3xl font-semibold text-stone-700 mb-3 sm:mb-4 text-shadow-md">Your Wishlist Awaits! ✨</h3>
          <p className="text-base sm:text-lg text-stone-600 mt-3 sm:mt-4">It's a bit quiet here... Let's fill it with magical items!</p>
        </div>
      ) : (
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-xl transform hover:-translate-y-2 transition-all duration-300 group relative border-2 border-stone-200 animate-pop-in flex flex-col" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                <button
                  onClick={() => handleFavoriteToggle(item.id, item.favorite ?? false)}
                  disabled={!isUnlocked}
                  className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-sm border border-stone-300
                    ${isUnlocked ? 'cursor-pointer active:scale-125' : 'cursor-not-allowed'}
                    ${item.favorite
                      ? 'bg-red-400 text-white' + (isUnlocked ? ' hover:bg-red-300' : '')
                      : 'bg-white/70 text-stone-600' + (isUnlocked ? ' hover:bg-red-100 hover:text-red-500' : '')
                    }`}
                  title={isUnlocked ? (item.favorite ? 'Unfavorite' : 'Favorite') : 'Unlock to favorite'}
                >
                  <FaHeart className={item.favorite ? 'fill-current' : ''} />
                </button>
              </div>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
                {!conciseMode && <img src={item.image || '/placeholder-item-image.png'} alt={item.title} className="w-full h-40 sm:h-48 object-contain rounded-t-xl" />}
              </a>
              <div className="p-3 sm:p-4 flex-grow">
                <div className={conciseMode ? 'pr-10' : ''}>
                  <ItemName name={item.title} lineClamp={1} />
                </div>
                <PriceDisplay price={item.price} />
                {!conciseMode && item.remarks && (
                  <CollapsibleRemark remark={item.remarks} />
                )}
              </div>
              {isUnlocked && (
                <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="w-10 h-10 flex items-center justify-center bg-stone-200 text-stone-600 hover:bg-blue-200 rounded-full transition-colors duration-300"
                    title="Edit item"
                  >
                    <FaPencilAlt className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setItemToDelete(item.id);
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-stone-200 text-stone-600 hover:bg-red-400 hover:text-white rounded-full transition-colors duration-300"
                    title="Delete item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-4 border-blue-300 text-center max-w-md w-full animate-pop-in">
            <h3 className="text-xl sm:text-2xl font-semibold text-stone-700 mb-4 sm:mb-6 text-shadow-md">Are you sure you want to clear ALL wishes? 🥺</h3>
            <p className="text-sm sm:text-base text-stone-600 mb-6 sm:mb-8">This cannot be undone! All your precious wishes will vanish!</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button onClick={() => setShowConfirm(false)} className="px-5 py-2 sm:px-6 sm:py-3 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                No, Keep Wishes!
              </button>
              <button onClick={() => {
                setShowConfirm(false);
                setShowFinalConfirm(true);
              }} className="bg-blue-500 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-full font-medium hover:bg-red-500 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                Yes, Vanish Them!
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-4 border-amber-300 text-center max-w-md w-full animate-pop-in">
            <h3 className="text-xl sm:text-2xl font-semibold text-stone-700 mb-4 sm:mb-6 text-shadow-md">Delete this wish?</h3>
            <p className="text-sm sm:text-base text-stone-600 mb-6 sm:mb-8">Are you sure you want to remove this item from the list?</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button onClick={() => setItemToDelete(null)} className="px-5 py-2 sm:px-6 sm:py-3 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                No, Keep It
              </button>
              <button onClick={confirmDeleteItem} className="bg-amber-500 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-full font-medium hover:bg-red-500 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-4 border-red-400 text-center max-w-md w-full animate-pop-in">
            <h3 className="text-2xl sm:text-3xl font-semibold text-red-600 mb-4 sm:mb-6 text-shadow-md animate-wiggle">ARE YOU SURE?</h3>
            <p className="text-sm sm:text-base text-stone-600 mb-6 sm:mb-8">This is your final warning! Deleting all wishes cannot be undone.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button onClick={() => setShowFinalConfirm(false)} className="px-5 py-2 sm:px-6 sm:py-3 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                On Second Thought...
              </button>
              <button onClick={handleClearAll} className="bg-red-500 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-full font-medium hover:bg-red-700 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                CONFIRM DELETION
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-4 border-blue-300 text-left max-w-lg w-full animate-pop-in">
            <h3 className="text-xl sm:text-2xl font-semibold text-stone-700 mb-4 sm:mb-6 text-shadow-md">Edit Wish</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-stone-700 text-sm font-bold mb-2">Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingItem.title}
                  required
                  className="border-2 border-stone-200 rounded-xl w-full p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
              </div>
              <div className="mb-4">
                <label className="block text-stone-700 text-sm font-bold mb-2">Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  defaultValue={editingItem.price?.amount || 0}
                  className="border-2 border-stone-200 rounded-xl w-full p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
              </div>
              <div className="mb-4">
                <label className="block text-stone-700 text-sm font-bold mb-2">Currency</label>
                <select
                    name="currency"
                    defaultValue={editingItem.price?.currency || 'AUD'}
                    className="border-2 border-stone-200 rounded-xl w-full p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300"
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
              <div className="mb-6">
                <label className="block text-stone-700 text-sm font-bold mb-2">Remarks</label>
                <textarea
                  name="remarks"
                  defaultValue={editingItem.remarks || ''}
                  className="border-2 border-stone-200 rounded-xl w-full p-3 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setEditingItem(null)} className="px-6 py-3 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-all duration-300 transform hover:scale-105">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-3 rounded-full bg-blue-300 text-white font-medium hover:bg-blue-400 transition-all duration-300 transform hover:scale-105">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

export default ItemList;