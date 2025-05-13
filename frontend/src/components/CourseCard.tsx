import React from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '../types/Course';
import { useAuth } from '../hooks/useAuth';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { isAuthenticated } = useAuth();

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'Для начинающих';
      case 'Middle':
        return 'Средний уровень';
      case 'Senior':
        return 'Продвинутый уровень';
      default:
        return difficulty;
    }
  };

  return (
    <div className="h-full">
      <Link to={isAuthenticated ? `/courses/${course.id}` : '#'} className="block h-full">
        <div className="card h-48 sm:h-56 bg-gray-300 relative overflow-hidden rounded-2xl">
          {/* Фон */}
          <img
            src={course.coverUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          {/* Оверлей */}
          <div className="absolute inset-0 bg-gray-500 opacity-30 rounded-2xl" />
          {/* Контент */}
          <div className="absolute inset-0 z-10 p-4 flex flex-col justify-between">
            {/* Автор и заголовок */}
            <div>
              <div className="mb-1 text-xs text-white">{course.authorName}</div>
              <h3 className="text-lg font-light leading-tight line-clamp-2 text-white">
                {course.title}
              </h3>
            </div>
            {/* Статистика */}
            <div className="flex items-center space-x-6 text-white">
              {/* Рейтинг */}
              <div className="flex items-center">
                <span className="text-yellow-400 mr-1 text-xs">★</span>
                <span className="text-sm">{course.stats.avgScore.toFixed(1)}</span>
              </div>
              {/* Длительность */}
              <div className="flex items-center">
                <svg className="w-3.5 h-3.5 text-green-400 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-sm">{course.estimatedDuration} ч</span>
              </div>
              {/* Уровень */}
              <div className="flex items-center">
                <svg className="w-3.5 h-3.5 text-blue-400 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-sm">{getDifficultyLabel(course.difficulty)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CourseCard;