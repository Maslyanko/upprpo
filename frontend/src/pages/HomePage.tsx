import React, { useEffect } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import Filters from '../components/Filters';
import CourseList from '../components/CourseList';
import { useCourses } from '../hooks/useCourses';

const HomePage: React.FC = () => {
  const { courses, loading, error, fetchCourses, filters: currentFilters } = useCourses();

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
    // Initial fetch if not already done by hook
    if (courses.length === 0 && !loading && !error) {
        fetchCourses(currentFilters);
    }
  }, []); // Empty dependency array to run once on mount

  const handleSearch = (query: string) => {
    fetchCourses({ ...currentFilters, search: query });
  };

  const handleFilterChange = (newFilters: { sort?: 'popularity' | 'difficulty' | 'duration'; level?: string; language?: string }) => {
    fetchCourses({ ...currentFilters, ...newFilters });
  };

  return (
    <div>
      <HeroSection />

      {/* Catalog Section */}
      <div id="catalog" className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
            <SearchBar onSearch={handleSearch} placeholder="Поиск курсов..." />
            <Filters onChange={handleFilterChange} />
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