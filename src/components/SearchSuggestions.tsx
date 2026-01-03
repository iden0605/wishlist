import React, { useState, useEffect, useRef } from 'react';

interface SearchSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  show: boolean;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({ suggestions, onSelect, show }) => {
  const [isCharacterOverlapping, setIsCharacterOverlapping] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCharacterMove = (event: CustomEvent) => {
      if (!dropdownRef.current || !show) {
        setIsCharacterOverlapping(false);
        return;
      }

      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const charRect = event.detail;

      // Check for overlap
      const overlap = !(
        dropdownRect.right < charRect.x ||
        dropdownRect.left > charRect.x + charRect.width ||
        dropdownRect.bottom < charRect.y ||
        dropdownRect.top > charRect.y + charRect.height
      );

      setIsCharacterOverlapping(overlap);
    };

    window.addEventListener('character-move', handleCharacterMove as EventListener);
    
    return () => {
      window.removeEventListener('character-move', handleCharacterMove as EventListener);
    };
  }, [show]);

  useEffect(() => {
    // When the dropdown is shown or hidden, update state and check position
    if (show) {
      // Actively request the character's position when dropdown opens
      window.dispatchEvent(new CustomEvent('request-character-position'));
    } else {
      setIsCharacterOverlapping(false);
    }
  }, [show]);

  if (!show || suggestions.length === 0) {
    return null;
  }

  const containerClasses = [
    "absolute z-50 w-full mt-1 rounded-2xl shadow-xl border-2 border-stone-200 animate-pop-in",
    "transition-opacity duration-300",
    isCharacterOverlapping ? "bg-white/50 bg-transparent backdrop-blur-[1px] border border-white/10" : "bg-white"
  ].join(" ");

  return (
    <div ref={dropdownRef} className={containerClasses}>
      <ul className="py-1">
        {suggestions.map((suggestion, index) => (
          <li
            key={index}
            onClick={() => onSelect(suggestion)}
            className="px-4 py-1 text-sm text-stone-700 cursor-pointer hover:bg-blue-100 transition-colors duration-200"
          >
            {suggestion}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchSuggestions;