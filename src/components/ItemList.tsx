import { useState, forwardRef } from 'react';
import { useItems, type SortByType } from '@/hooks/useItems';
import { doc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ItemListProps {
  sortBy: SortByType;
  isUnlocked: boolean;
  promptForPassword: () => void;
  showImages: boolean;
}

const ItemList = forwardRef<HTMLDivElement, ItemListProps>(({ sortBy, isUnlocked, promptForPassword, showImages }, ref) => {
  const { items, loading } = useItems(sortBy);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async (id:string) => {
    if (!isUnlocked) {
      promptForPassword();
      return;
    }
    const itemDoc = doc(db, 'items', id);
    await deleteDoc(itemDoc);
  };

  const handleClearAll = async () => {
    if (!isUnlocked) {
      promptForPassword();
      setShowConfirm(false);
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
  };

  if (loading) {
    return <p className="text-center text-stone-700 text-xl font-semibold mt-8 animate-pulse text-shadow-sm">Summoning items from the cozy ether... ✨</p>;
  }

  return (
    <div> {/* Outer div without ref */}
      <div className="flex justify-end mb-4 items-center">
        {isUnlocked && (
          <button onClick={() => setShowConfirm(true)} className="bg-blue-300 hover:bg-blue-400 text-white font-semibold py-2 px-4 sm:py-3 sm:px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-shadow-sm text-sm sm:text-base">
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
            <div key={item.id} className="bg-white rounded-2xl shadow-xl overflow-hidden transform hover:-translate-y-2 transition-all duration-300 group relative border-2 border-stone-200 animate-pop-in" style={{ animationDelay: `${index * 0.1}s` }}>
              {isUnlocked && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                className="absolute top-2 right-2 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white/70 hover:bg-blue-500 text-stone-600 hover:text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 backdrop-blur-sm border border-stone-300"
                title="Delete item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              )}
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                {showImages && <img src={item.image || 'https://via.placeholder.com/400x300/E0F2F7/4A4A4A?text=No+Image'} alt={item.title} className="w-full h-40 sm:h-48 object-contain rounded-t-xl" />}
                <div className="p-3 sm:p-4">
                  <h3 className="text-base sm:text-xl font-semibold text-stone-700 truncate text-shadow-sm">{item.title}</h3>
                  <p className="text-blue-400 font-semibold text-md sm:text-lg mt-1 sm:mt-2 text-shadow-sm">
                    {item.price ? `$${item.price.toFixed(2)}` : 'Price unknown!'}
                  </p>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-4 border-blue-300 text-center max-w-md w-full animate-pop-in">
            <h3 className="text-xl sm:text-2xl font-semibold text-stone-700 mb-4 sm:mb-6 text-shadow-md">Are you sure you want to clear ALL wishes? 🥺</h3>
            <p className="text-sm sm:text-base text-stone-600 mb-6 sm:mb-8">This cannot be undone! All your precious wishes will vanish!</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <button onClick={() => setShowConfirm(false)} className="px-5 py-2 sm:px-6 sm:py-3 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                No, Keep Wishes!
              </button>
              <button onClick={handleClearAll} className="bg-blue-500 text-white px-5 py-2 sm:px-6 sm:py-3 rounded-full font-medium hover:bg-red-500 transition-all duration-300 transform hover:scale-105 shadow-md text-shadow-sm text-sm sm:text-base">
                Yes, Vanish Them!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ItemList;