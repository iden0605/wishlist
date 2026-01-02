import { useState, useEffect, useCallback, useRef } from 'react';
import PasswordGate from '@/components/PasswordGate';
import AddItem from '@/components/AddItem';
import ItemList from '@/components/ItemList';
import FilterBar from '@/components/FilterBar';
import CharacterAnimation from '@/components/CharacterAnimation';
import { useItems, type SortByType } from '@/hooks/useItems'; // Import useItems

const SESSION_KEY = 'jocelyn-wishlist-auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sortBy, setSortBy] = useState<SortByType>({ field: 'createdAt', direction: 'desc' });
  const [isAddItemLoading, setIsAddItemLoading] = useState(false);

  // Ref for the target AddItem div
  const addItemRef = useRef<HTMLDivElement>(null);

  const { loading: isItemsLoading } = useItems(sortBy); // Use the loading state from useItems

  // Combine all loading states
  const isGlobalLoading = isItemsLoading || isAddItemLoading;

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [string, 'asc' | 'desc'];
    setSortBy({ field, direction });
  };

  useEffect(() => {
    const hasSession = localStorage.getItem(SESSION_KEY);
    if (hasSession) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    localStorage.setItem(SESSION_KEY, 'true');
    setIsAuthenticated(true);
  };

  // Callback for AddItem loading state
  const handleAddItemLoadingChange = useCallback((isLoading: boolean) => {
    setIsAddItemLoading(isLoading);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl border-4 border-stone-200">
          <PasswordGate onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-blue-100 rounded-3xl shadow-xl border-4 border-blue-300">
      <h1 className="text-4xl md:text-5xl font-semibold text-center my-6 md:my-8 text-stone-700 text-shadow-md">Jocelyn's Wishlist ✨</h1>
      <CharacterAnimation
        isLoading={isGlobalLoading}
        addItemRef={addItemRef as React.RefObject<HTMLDivElement>}
      />
      <div ref={addItemRef} className="mb-8 md:mb-12 p-4 md:p-6 bg-white rounded-2xl shadow-md border-2 border-stone-200">
        <AddItem onLoadingChange={handleAddItemLoadingChange} />
      </div>
      <FilterBar
        onSortChange={handleSortChange}
      />
      <ItemList sortBy={sortBy} />
    </div>
  );
}

export default App;
