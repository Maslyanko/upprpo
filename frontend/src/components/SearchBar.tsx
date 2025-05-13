// frontend/src/components/SearchBar.tsx
import React from 'react';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onSearch: () => void; // Changed: onSearch will now be called without arguments
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Поиск',
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(); // Call onSearch without query, HomePage will use its own state
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value); // Update parent's state
  };

  return (
    <div className="relative flex-1">
      <form onSubmit={handleSubmit} className="flex">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
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
          value={value} // Controlled by parent
          onChange={handleInputChange} // Notify parent of change
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        />
      </form>
    </div>
  );
};

export default SearchBar;