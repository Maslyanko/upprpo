import React from 'react';

interface FiltersProps {
  onChange: (filters: { sort?: 'popularity' | 'difficulty' | 'duration'; level?: string; language?: string }) => void;
}

const Filters: React.FC<FiltersProps> = ({ onChange }) => {
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ sort: e.target.value as 'popularity' | 'difficulty' | 'duration' });
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ level: e.target.value });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ language: e.target.value });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Сортировка */}
      <div className="relative">
        <select
          onChange={handleSortChange}
          defaultValue="popularity"
          className="select-filter select-primary rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="popularity">Сначала: Популярное</option>
          <option value="difficulty">Сначала: Сложность</option>
          <option value="duration">Сначала: Длительность</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Уровень */}
      <div className="relative">
        <select
          onChange={handleLevelChange}
          defaultValue=""
          className="select-filter select-dark rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="">Уровень</option>
          <option value="Beginner">Beginner</option>
          <option value="Middle">Middle</option>
          <option value="Senior">Senior</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Язык */}
      <div className="relative">
        <select
          onChange={handleLanguageChange}
          defaultValue=""
          className="select-filter select-dark rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="">Язык</option>
          <option value="JavaScript">JavaScript</option>
          <option value="Python">Python</option>
          <option value="SQL">SQL</option>
          <option value="Java">Java</option>
          <option value="C++">C++</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Filters;
