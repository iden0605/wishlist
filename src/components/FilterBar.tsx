import React, { forwardRef } from 'react';

interface FilterBarProps {
  onSortChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(({ onSortChange }, ref) => {
  return (
    <div ref={ref} className="flex flex-col sm:flex-row justify-end items-center mb-6 p-3 sm:p-4 bg-white rounded-2xl shadow-lg border-2 border-stone-200 animate-pop-in">
      <label htmlFor="sort-by" className="text-stone-700 font-semibold mr-0 sm:mr-3 text-lg sm:text-xl text-shadow-sm mb-2 sm:mb-0">Sort By:</label>
      <select
        id="sort-by"
        onChange={onSortChange}
        className="p-2 sm:p-3 rounded-xl border-2 border-stone-300 bg-white shadow-md text-stone-700 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-300 appearance-none pr-8 text-base sm:text-lg w-full sm:w-auto"
      >
        <option value="createdAt-desc">✨ Newest First</option>
        <option value="createdAt-asc">🕰️ Oldest First</option>
        <option value="title-asc"> alphabetically (A-Z)</option>
        <option value="title-desc"> alphabetically (Z-A)</option>
        <option value="price-asc"> Cheapest First</option>
        <option value="price-desc"> Most Expensive First</option>
      </select>
    </div>
  );
});

export default FilterBar;