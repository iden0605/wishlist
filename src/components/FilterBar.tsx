import React from 'react';
import { useCategories } from '@/hooks/useCategories';

interface FilterBarProps {
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  onSortChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ selectedCategory, setSelectedCategory, onSortChange }) => {
  const { categories, loading } = useCategories();

  return (
    <div className="flex justify-between items-center mb-6 p-4 bg-white rounded-xl shadow-lg">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${!selectedCategory ? 'bg-pink-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          All
        </button>
        {loading ? (
          <p>Loading...</p>
        ) : (
          categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${selectedCategory === category.id ? 'bg-pink-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              {category.name}
            </button>
          ))
        )}
      </div>
      <select onChange={onSortChange} className="p-2 rounded-lg border bg-white shadow-sm">
        <option value="createdAt-desc">Date (Newest)</option>
        <option value="createdAt-asc">Date (Oldest)</option>
        <option value="title-asc">A-Z</option>
        <option value="title-desc">Z-A</option>
        <option value="price-asc">Price (Low to High)</option>
        <option value="price-desc">Price (High to Low)</option>
      </select>
    </div>
  );
};

export default FilterBar;