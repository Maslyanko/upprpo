// ==== File: frontend/src/pages/HomePage.tsx ====
import React, { useEffect, useRef, useState } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import CourseList from '../components/CourseList';
import { useCourses, CourseFilters, defaultCourseFilters } from '../hooks/useCourses';

// Assuming COMMON_LANGUAGE_TAG_OPTIONS is available or defined here/imported
const COMMON_LANGUAGE_TAG_OPTIONS: Readonly<string[]> = [
    'Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Русский', 'English'
];

const HomePage: React.FC = () => {
  // Initialize with defaultCourseFilters to ensure all filter fields are defined
  const { courses, loading, error, filters: currentActiveFilters, applyFilters } = useCourses(defaultCourseFilters);
  const catalogRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState(currentActiveFilters.search || '');

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
  }, []);

  useEffect(() => {
    if (currentActiveFilters.search !== searchTerm) {
      setSearchTerm(currentActiveFilters.search || '');
    }
  }, [currentActiveFilters.search, searchTerm]); // Added searchTerm to deps to avoid potential stale closure issue

  const handleSearch = () => {
    applyFilters({
      ...defaultCourseFilters,
      sort: currentActiveFilters.sort || defaultCourseFilters.sort,
      search: searchTerm.trim(),
    });
  };

  const handleTagClick = (tag: string) => {
    setSearchTerm('');
    let newLevel: CourseFilters['level'] | undefined = undefined;
    let newLanguage: string | undefined = undefined;
    const otherTags: string[] = [];

    if (['Beginner', 'Middle', 'Senior'].includes(tag)) {
      newLevel = tag as CourseFilters['level'];
    } else if (COMMON_LANGUAGE_TAG_OPTIONS.includes(tag)) {
      newLanguage = tag;
    } else {
      otherTags.push(tag);
    }

    applyFilters({
      ...defaultCourseFilters,
      sort: currentActiveFilters.sort || defaultCourseFilters.sort,
      level: newLevel,
      language: newLanguage,
      tags: otherTags,
    });
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    applyFilters(defaultCourseFilters);
  };

  // console.log("HomePage rendering. Loading:", loading, "Error:", error, "Courses:", courses.length); // DEBUG

  return (
    <div>
      <HeroSection onTagClick={handleTagClick} />
      <div id="catalog" ref={catalogRef} className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleSearch}
              placeholder="Поиск по названию, автору или тегам..."
            />
            <button
              onClick={handleResetFilters}
              className="btn-outline px-4 py-2.5 text-sm whitespace-nowrap" // Assuming btn-outline is defined
              title="Сбросить все фильтры и поиск"
            >
              Сбросить фильтры
            </button>
          </div>
          <div className="min-h-[300px]"> {/* Ensure this has a min height to be visible if CourseList content is delayed/empty */}
            <CourseList courses={courses} loading={loading} error={error} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;