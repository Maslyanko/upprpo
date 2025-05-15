import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '@/api/userApi'; // Убедись, что путь верный

interface ActiveCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const ActiveCourseCard: React.FC<ActiveCourseCardProps> = ({ enrollment }) => {
  const { course, progress } = enrollment;
  const totalLessons = course.lessons?.length || 1;
  // Рассчитываем количество завершенных уроков на основе прогресса (0-100)
  // Округляем до ближайшего целого
  const completedLessons = Math.round((progress / 100) * totalLessons);

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height for title */}

         {/* Progress Bar */}
         <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Прогресс</span>
                <span>{completedLessons}/{totalLessons}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"> {/* Added overflow-hidden */}
                <div
                    className="bg-orange-500 h-2 rounded-full transition-width duration-300 ease-in-out" // Added transition
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                ></div>
            </div>
        </div>
      </div>
      <Link
        to={`/courses/${course.id}`} // Ссылка на страницу курса
        className="block w-full mt-auto px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors font-medium text-sm" // Added focus styles
      >
        Продолжить
      </Link>
    </div>
  );
};

export default ActiveCourseCard;