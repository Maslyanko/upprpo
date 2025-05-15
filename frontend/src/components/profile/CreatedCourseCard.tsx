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
  // Убедимся, что course.tags существует и является массивом перед вызовом getDifficultyFromTags
  const difficulty = getDifficultyFromTags(Array.isArray(course.tags) ? course.tags : []) || 'Не указан';

  return (
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2 h-14">{course.title}</h3>
        <p className="text-xs text-gray-500 mb-3">Сложность: {difficulty}</p>
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: <span className="font-medium text-gray-800">{course.stats?.enrollments ?? 0}</span></p>
            <p>Статус: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && course.version && <p>Версия: <span className="font-medium text-gray-800">{course.version}</span></p>}
        </div>
      </div>
       <div className="flex flex-col sm:flex-row gap-2 mt-auto">
           <Link
                to={`/courses/${course.id}/edit-facade`} // Одна кнопка "Редактировать"
                className="flex-1 btn-primary text-sm text-center py-2.5"
            >
                Редактировать
            </Link>
            <Link
                to={`/courses/${course.id}`} // Ссылка на страницу просмотра/деталей курса
                className="flex-1 btn-secondary text-sm text-center py-2.5"
            >
                Статистика
            </Link>
       </div>
    </div>
  );
};

export default CreatedCourseCard;