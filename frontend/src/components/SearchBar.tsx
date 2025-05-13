// frontend/src/components/SearchBar.tsx
import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialQuery?: string; // To prefill or reset the search bar
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = 'Поиск',
  initialQuery = '' 
}) => {
  const [query, setQuery] = useState(initialQuery);

  // Effect to update internal query state if initialQuery prop changes (e.g., on reset)
  useEffect(() => {
    setQuery(initialQuery || ''); // Ensure it resets to empty string if initialQuery is undefined/null
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };
  
  // Optional: Allow submitting search on blur or with a slight delay after typing
  // const handleBlur = () => {
  //   onSearch(query);
  // };

  // Remove onKeyPress if form submission is preferred, or keep if direct enter key press is desired
  // const handleKeyPress = (e: React.KeyboardEvent) => {
  //   if (e.key === 'Enter') {
  //     onSearch(query);
  //   }
  // };

  return (
    <div className="relative flex-1"> {/* Removed max-w-lg to allow it to grow */}
      <form onSubmit={handleSubmit} className="flex">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg 
            className="w-4 h-4 text-gray-400" // Slightly larger icon
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth="2"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          // onBlur={handleBlur} // Optional: search on blur
          // onKeyPress={handleKeyPress} // Optional: keep if needed
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        />
        {/* You could add an explicit search button here if desired */}
        {/* <button type="submit" className="ml-2 px-4 py-2 bg-orange-500 text-white rounded-lg">Найти</button> */}
      </form>
    </div>
  );
};

export default SearchBar;