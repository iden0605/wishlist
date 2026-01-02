import { useState, useEffect } from 'react';
import PasswordGate from '@/components/PasswordGate';
import Categories from '@/components/Categories';
import AddItem from '@/components/AddItem';
import ItemList from '@/components/ItemList';

const SESSION_KEY = 'jocelyn-wishlist-auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center my-6">Jocelyn's Wishlist</h1>
      <AddItem />
      <Categories selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
      <ItemList selectedCategory={selectedCategory} />
    </div>
  );
}

export default App;
