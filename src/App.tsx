import { useState, useEffect } from 'react';
import PasswordGate from '@/components/PasswordGate';
import Categories from '@/components/Categories';
import AddItem from '@/components/AddItem';
import ItemList from '@/components/ItemList';
import FilterBar from '@/components/FilterBar';
import { type SortByType } from '@/hooks/useItems';

const SESSION_KEY = 'jocelyn-wishlist-auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortByType>({ field: 'createdAt', direction: 'desc' });

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

  if (!isAuthenticated) {
    return <PasswordGate onLogin={handleLogin} />;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold text-center my-8 text-gray-800">Jocelyn's Wishlist</h1>
      <div className="mb-12">
        <AddItem />
      </div>
      <div className="mb-12">
        <Categories />
      </div>
      <FilterBar
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        onSortChange={handleSortChange}
      />
      <ItemList selectedCategory={selectedCategory} sortBy={sortBy} />
    </div>
  );
}

export default App;
