import React from 'react';
import type { Course } from '../types/Course';
import CourseCard from './CourseCard';

interface CourseListProps {
  courses: Course[];
  loading?: boolean;
  error?: Error | null;
}

const CourseList: React.FC<CourseListProps> = ({ 
  courses, 
  loading = false, 
  error = null 
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Произошла ошибка при загрузке курсов</div>
        <div className="text-gray-500 text-sm">{error.message}</div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-2">Курсы не найдены</div>
        <div className="text-gray-400 text-sm">Попробуйте изменить параметры поиска</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
};

export default CourseList;