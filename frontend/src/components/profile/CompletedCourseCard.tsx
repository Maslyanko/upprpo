import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '@/api/userApi'; // Убедись, что путь верный

interface CompletedCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const CompletedCourseCard: React.FC<CompletedCourseCardProps> = ({ enrollment }) => {
  const { course, userRating } = enrollment;
  // Текст результата. Можно добавить больше логики, если API дает оценку
  const resultText = `Результат: ${userRating ? `${userRating}/5` : 'Завершено'}`;

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
        <div>
            <p className="text-xs text-gray-500 mb-1">{course.authorName}</p>
             <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height */}
            {/* Отображаем результат/оценку */}
            <p className="text-sm font-medium text-green-600">{resultText}</p>
        </div>
        {/* Можно добавить кнопку "Повторить" или "Сертификат" */}
        <Link
            to={`/courses/${course.id}`} // Ссылка на страницу курса для просмотра
            className="block w-full mt-auto px-4 py-2 bg-gray-200 text-gray-700 text-center rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors font-medium text-sm" // Secondary button style
        >
            Посмотреть
        </Link>
    </div>
  );
};

export default CompletedCourseCard;