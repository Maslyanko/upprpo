import React, { useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import Filters from '../components/Filters';
import CourseList from '../components/CourseList';
import { useCourses } from '../hooks/useCourses';

const CatalogPage: React.FC = () => {
  const { courses, loading, error, fetchCourses } = useCourses();

  useEffect(() => {
    document.title = 'Каталог курсов - AI-Hunt';
  }, []);

  const handleSearch = (query: string) => {
    fetchCourses({ search: query });
  };

  const handleFilterChange = (filters: { sort?: string; level?: string; language?: string }) => {
    fetchCourses(filters);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Каталог курсов</h1>
      
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
  );
};

export default CatalogPage;