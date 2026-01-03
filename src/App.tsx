import { useState, useEffect, useCallback, useRef } from 'react';
import AddItem from '@/components/AddItem';
import ItemList from '@/components/ItemList';
import FilterBar from '@/components/FilterBar';
import CharacterAnimation from '@/components/CharacterAnimation';
import { useItems, type SortByType } from '@/hooks/useItems'; // Import useItems

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    const unlockTimestamp = localStorage.getItem('unlockTimestamp');
    if (unlockTimestamp) {
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - parseInt(unlockTimestamp, 10) < thirtyMinutes) {
        setIsUnlocked(true);
      } else {
        localStorage.removeItem('unlockTimestamp');
      }
    }
  }, []);

  useEffect(() => {
    if (showSuccessPopup) {
      const timer = setTimeout(() => {
        setShowSuccessPopup(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccessPopup]);

  const [sortBy, setSortBy] = useState<SortByType>({ field: 'createdAt', direction: 'desc' });
  const [isAddItemLoading, setIsAddItemLoading] = useState(false);
  const [showImages, setShowImages] = useState(true);

  const addItemRef = useRef<HTMLDivElement>(null);

  const { loading: isItemsLoading } = useItems(sortBy);

  const isGlobalLoading = isItemsLoading || isAddItemLoading;

  const handleSortChange = (sortByValue: SortByType) => {
    setSortBy(sortByValue);
  };

  const handleShowImagesChange = (show: boolean) => {
    setShowImages(show);
  };


  const handleUnlock = () => {
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      setIsUnlocked(true);
      localStorage.setItem('unlockTimestamp', Date.now().toString());
      setShowPasswordPrompt(false);
      setError('');
      setPassword('');
      setShowSuccessPopup(true);
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  const promptForPassword = () => {
    setShowPasswordPrompt(true);
  };

  const handleAddItemLoadingChange = useCallback((isLoading: boolean) => {
    setIsAddItemLoading(isLoading);
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8 bg-blue-100 rounded-3xl shadow-xl border-4 border-blue-300 relative">
      {!isUnlocked && (
        <button
          onClick={promptForPassword}
          className="absolute top-4 right-4 bg-blue-300 hover:bg-blue-400 text-white font-semibold py-2 px-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 z-20"
        >
          Unlock Editing 🔓
        </button>
      )}
      <h1 className="text-4xl md:text-5xl font-semibold text-center my-6 md:my-8 text-stone-700 text-shadow-md">Jocelyn's Wishlist ✨</h1>
      <CharacterAnimation
        isLoading={isGlobalLoading}
        addItemRef={addItemRef as React.RefObject<HTMLDivElement>}
      />
      <div ref={addItemRef} className="mb-8 md:mb-12 p-4 md:p-6 bg-white rounded-2xl shadow-md border-2 border-stone-200">
        <AddItem onLoadingChange={handleAddItemLoadingChange} isUnlocked={isUnlocked} promptForPassword={promptForPassword} />
      </div>
      <FilterBar
        onSortChange={handleSortChange}
        onShowImagesChange={handleShowImagesChange}
        showImages={showImages}
      />
      <ItemList sortBy={sortBy} isUnlocked={isUnlocked} promptForPassword={promptForPassword} showImages={showImages} />

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl max-w-sm w-full border-4 border-stone-200 transform scale-95 animate-pop-in">
            <h2 className="text-2xl sm:text-3xl font-semibold text-center text-blue-700 mb-3 sm:mb-4 text-shadow-md">Unlock Editing</h2>
            <p className="text-stone-700 text-center mb-4 sm:mb-6 text-base sm:text-lg">Enter the password to make changes.</p>
            <div className="mb-4 sm:mb-6">
              <label htmlFor="password" className="block text-stone-700 text-sm sm:text-md font-medium mb-1 sm:mb-2 text-shadow-sm">
                Secret Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                className="p-3 sm:p-4 rounded-xl border-2 border-stone-300 w-full focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-md text-stone-700 placeholder-stone-400 text-base sm:text-lg"
                placeholder="Shhh... it's a secret!"
              />
            </div>
            {error && <p className="text-red-700 font-semibold text-center mb-3 sm:mb-4 bg-red-200 p-2 sm:p-3 rounded-lg border-2 border-red-500 animate-bounce animate-wiggle text-shadow-sm text-sm">{error}</p>}
            <div className="flex items-center justify-around">
              <button
                onClick={() => setShowPasswordPrompt(false)}
                className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2 sm:py-3 px-6 sm:px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-stone-300 text-base sm:text-lg text-shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                className="bg-blue-300 hover:bg-blue-400 text-white font-semibold py-2 sm:py-3 px-6 sm:px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 text-base sm:text-lg text-shadow-sm"
              >
                Unlock 🔑
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl max-w-sm w-full border-4 border-green-400 transform scale-95 animate-pop-in">
            <h2 className="text-2xl sm:text-3xl font-semibold text-center text-green-700 mb-3 sm:mb-4 text-shadow-md">
              Successfully Unlocked!
            </h2>
            <img src="/animations/jump.gif" alt="Unlocked" className="mx-auto w-32 h-32 sm:w-40 sm:h-40" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
