// frontend/src/pages/HomePage.tsx
import React, { useEffect, useRef } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import CourseList from '../components/CourseList';
import { useCourses, CourseFilters } from '../hooks/useCourses'; // Import CourseFilters

// Define initial/default filters
const initialCourseFilters: CourseFilters = {
  sort: 'popularity',
  tags: [],
  search: '',
  level: undefined, // Or '' if your API/hook prefers empty strings
  language: undefined, // Or ''
};


const HomePage: React.FC = () => {
  const { courses, loading, error, filters: currentActiveFilters, applyFilters } = useCourses();
  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
  }, []);

  const handleSearch = (query: string) => {
    // When searching, we might want to keep other filters or clear them.
    // Let's keep sort, but clear tags, level, language if a new text search is initiated.
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity', // Keep current sort or default
      search: query,
      tags: [], // Clear tags on new text search
      level: undefined,
      language: undefined,
    });
  };

  const handleTagClick = (tag: string) => {
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity', // Keep current sort
      search: '', // Clear search when a tag is clicked
      tags: [tag], // Set the new tag filter
      level: undefined,
      language: undefined,
    });
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    // Reset to initial/default filters
    applyFilters(initialCourseFilters);
    // Optionally, clear the SearchBar's internal state if it has one and doesn't reset automatically
    // This might require an imperative handle or a key change on SearchBar if its input is not controlled by HomePage
  };

  return (
    <div>
      <HeroSection onTagClick={handleTagClick} />
      <div id="catalog" ref={catalogRef} className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          {/* Search bar and Reset Button Container */}
          <div className="flex items-center gap-x-3 mb-8">
            <div className="flex-grow"> {/* SearchBar takes most space */}
              <SearchBar
                onSearch={handleSearch}
                placeholder="Поиск по названию, автору или тегам..."
                initialQuery={currentActiveFilters.search} // Pass current search to prefill
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              title="Сбросить все фильтры и поиск"
            >
              Сбросить
            </button>
          </div>
          <CourseList 
            courses={courses} 
            loading={loading} 
            error={error} 
          />
        </div>
      </div>
    </div>
  );
};

export default HomePage;