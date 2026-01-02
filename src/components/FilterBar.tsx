import React, { useState, forwardRef } from 'react';
import type { SortByType } from '@/hooks/useItems';
import { type OrderByDirection } from 'firebase/firestore';

interface FilterBarProps {
  onSortChange: (sortBy: SortByType) => void;
}

interface SortOption {
  value: string;
  label: string;
  field: string;
  direction: OrderByDirection;
}

const sortOptions: SortOption[] = [
  { value: 'createdAt-desc', label: '✨ Newest First', field: 'createdAt', direction: 'desc' },
  { value: 'createdAt-asc', label: '🕰️ Oldest First', field: 'createdAt', direction: 'asc' },
  { value: 'title-asc', label: ' alphabetically (A-Z)', field: 'title', direction: 'asc' },
  { value: 'title-desc', label: ' alphabetically (Z-A)', field: 'title', direction: 'desc' },
  { value: 'price-asc', label: ' Cheapest First', field: 'price', direction: 'asc' },
  { value: 'price-desc', label: ' Most Expensive First', field: 'price', direction: 'desc' },
];

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(({ onSortChange }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(sortOptions[0].label);

  const handleOptionClick = (option: SortOption) => {
    onSortChange({ field: option.field, direction: option.direction });
    setSelectedLabel(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="flex flex-col sm:flex-row justify-end items-center mb-6 p-3 sm:p-4 bg-white rounded-2xl shadow-lg border-2 border-stone-200 animate-pop-in">
      <label className="text-stone-700 font-semibold mr-0 sm:mr-3 text-lg sm:text-xl text-shadow-sm mb-2 sm:mb-0">Sort By:</label>
      <div className="relative w-full sm:w-auto">
        <button
          type="button"
          className="flex justify-between items-center w-full p-2 sm:p-3 rounded-xl border-2 border-stone-300 bg-white shadow-md text-stone-700 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-300 text-base sm:text-lg cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedLabel}
          <svg className={`ml-2 h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border-2 border-stone-300 rounded-xl shadow-lg z-20">
            {sortOptions.map((option) => (
              <div
                key={option.value}
                className="p-2 sm:p-3 text-stone-700 hover:bg-blue-100 cursor-pointer text-base sm:text-lg last:rounded-b-xl first:rounded-t-xl"
                onClick={() => handleOptionClick(option)}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default FilterBar;