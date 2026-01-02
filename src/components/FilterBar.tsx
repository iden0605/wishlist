import React from 'react';

interface FilterBarProps {
  onSortChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ onSortChange }) => {
  return (
    <div className="flex justify-end items-center mb-6 p-4 bg-white rounded-xl shadow-lg">
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