// frontend/src/pages/HomePage.tsx
import React, { useEffect, useRef, useState } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import CourseList from '../components/CourseList';
import { useCourses, CourseFilters } from '../hooks/useCourses';

const initialCourseFilters: CourseFilters = {
  sort: 'popularity',
  tags: [],
  search: '',
  level: undefined,
  language: undefined,
};

const HomePage: React.FC = () => {
  const { courses, loading, error, filters: currentActiveFilters, applyFilters } = useCourses();
  const catalogRef = useRef<HTMLDivElement>(null);
  // State for the search bar input, controlled by HomePage
  const [searchTerm, setSearchTerm] = useState(currentActiveFilters.search || '');

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
  }, []);

  // Sync searchTerm with external changes to currentActiveFilters.search
  // (e.g., if filters are reset or tag click clears search)
  useEffect(() => {
    if (currentActiveFilters.search !== searchTerm) {
      setSearchTerm(currentActiveFilters.search || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActiveFilters.search]);


  const handleSearch = () => {
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity',
      search: searchTerm, // Use the local searchTerm state
      tags: [],
      level: undefined,
      language: undefined,
    });
  };

  const handleTagClick = (tag: string) => {
    setSearchTerm(''); // Clear search term when a tag is clicked
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity',
      search: '',
      tags: [tag],
      level: undefined,
      language: undefined,
    });
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSearchTerm(''); // Clear local search term state
    applyFilters(initialCourseFilters);
  };

  return (
    <div>
      <HeroSection onTagClick={handleTagClick} />
      <div id="catalog" ref={catalogRef} className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          <div className="flex items-center gap-x-3 mb-8">
            <div className="flex-grow">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm} // Controlled component: update searchTerm
                onSearch={handleSearch} // Trigger search using HomePage's searchTerm
                placeholder="Поиск по названию, автору или тегам..."
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
          {/* Wrapper for CourseList to prevent layout jumps */}
          <div className="min-h-[300px]"> {/* Adjust min-height as needed */}
            <CourseList
              courses={courses}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;