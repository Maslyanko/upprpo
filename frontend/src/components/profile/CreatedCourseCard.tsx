// ===== ./src/components/profile/CreatedCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { Course } from '@/types/Course'; // Убедись, что путь верный

interface CreatedCourseCardProps {
  course: Course;
}

const CreatedCourseCard: React.FC<CreatedCourseCardProps> = ({ course }) => {
  const statusText = course.isPublished ? 'Опубликован' : 'Черновик';
  const statusColor = course.isPublished ? 'text-green-600 bg-green-100' : 'text-yellow-700 bg-yellow-100';

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height */}
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: <span className="font-medium text-gray-800">{course.stats?.enrollments ?? 0}</span></p>
            <p>Статус: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && <p>Версия: <span className="font-medium text-gray-800">{course.version}</span></p>}
        </div>
      </div>
       <div className="flex flex-col sm:flex-row gap-2 mt-auto"> {/* Changed to mt-auto */}
           <Link
                to={`/courses/${course.id}/edit`} // Ссылка на редактор курса
                className="flex-1 px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors font-medium text-sm"
            >
                Редактировать
            </Link>
            <Link
                to={`/courses/${course.id}/stats`} // Ссылка на статистику курса
                className="flex-1 px-4 py-2 bg-gray-800 text-white text-center rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition-colors font-medium text-sm"
            >
                Статистика
            </Link>
       </div>
    </div>
  );
};

export default CreatedCourseCard;