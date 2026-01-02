import React, { useState } from 'react';
import { useItems, type SortByType } from '@/hooks/useItems';

interface ItemListProps {
  selectedCategory: string | null;
}

const ItemList: React.FC<ItemListProps> = ({ selectedCategory }) => {
  const [sortBy, setSortBy] = useState<SortByType>({ field: 'createdAt', direction: 'desc' });
  const { items, loading } = useItems(selectedCategory, sortBy);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [string, 'asc' | 'desc'];
    setSortBy({ field, direction });
  };

  if (loading) {
    return <p>Loading items...</p>;
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <select onChange={handleSortChange} className="p-2 rounded border bg-white">
          <option value="createdAt-desc">Date (Newest)</option>
          <option value="createdAt-asc">Date (Oldest)</option>
          <option value="title-asc">A-Z</option>
          <option value="title-desc">Z-A</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
        {items.map((item) => (
          <div key={item.id} className="bg-soft-blue rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              <img src={item.image || 'https://via.placeholder.com/400x300'} alt={item.title} className="w-full h-48 object-cover" />
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ItemList;