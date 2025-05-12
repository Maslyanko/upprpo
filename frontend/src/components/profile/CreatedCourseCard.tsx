// ===== ./src/components/profile/CreatedCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { Course } from '../../types/Course'; // Adjust path if needed

interface CreatedCourseCardProps {
  course: Course;
}

const CreatedCourseCard: React.FC<CreatedCourseCardProps> = ({ course }) => {
  const statusText = course.isPublished ? 'Опубликован' : 'Черновик';
  const statusColor = course.isPublished ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className="bg-white rounded-lg shadow-card p-5 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2">{course.title}</h3>
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: {course.stats?.enrollments || 0}</p>
            <p>Статус: <span className={`font-medium ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && <p>Версия: {course.version}</p>}
        </div>
      </div>
       <div className="flex flex-col sm:flex-row gap-2 mt-4">
           <Link
                to={`/courses/${course.id}/edit`} // Link to course editor
                className="flex-1 px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 transition-colors font-medium text-sm"
            >
                Редактировать
            </Link>
            <Link
                to={`/courses/${course.id}/stats`} // Link to course statistics
                className="flex-1 px-4 py-2 bg-gray-800 text-white text-center rounded-md hover:bg-gray-700 transition-colors font-medium text-sm"
            >
                Статистика
            </Link>
       </div>
    </div>
  );
};

export default CreatedCourseCard;