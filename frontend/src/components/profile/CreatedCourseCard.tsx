// ==== File: frontend/src/components/profile/CreatedCourseCard.tsx ====
import React from 'react';
import { Link } from 'react-router-dom';
import { Course, getDifficultyFromTags } from '@/types/Course';

interface CreatedCourseCardProps {
  course: Course;
}

const CreatedCourseCard: React.FC<CreatedCourseCardProps> = ({ course }) => {
  const statusText = course.isPublished ? 'Опубликован' : 'Черновик';
  const statusColor = course.isPublished ? 'text-green-600 bg-green-100' : 'text-yellow-700 bg-yellow-100';
  const difficulty = getDifficultyFromTags(Array.isArray(course.tags) ? course.tags : []) || 'Не указан';

  return (
    <Link 
      to={`/courses/${course.id}/manage`} 
      className="block bg-white rounded-xl p-5 shadow-lg border border-transparent hover:border-orange-400 flex flex-col justify-between h-full group transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 mb-1 line-clamp-2 h-14 transition-colors duration-200">{course.title}</h3>
        <p className="text-xs text-gray-500 mb-3">Сложность: {difficulty}</p>
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: <span className="font-medium text-gray-800">{course.stats?.enrollments ?? 0}</span></p>
            <p>Статус: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && course.version && <p>Версия: <span className="font-medium text-gray-800">{course.version}</span></p>}
        </div>
      </div>
       <div className="mt-auto flex justify-end items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500 opacity-70 group-hover:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
       </div>
    </Link>
  );
};

export default CreatedCourseCard;