// ==== File: frontend/src/components/CourseCard.tsx ====
import React from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '../types/Course';
import { useAuth } from '../hooks/useAuth';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { isAuthenticated } = useAuth();

  const getDifficultyLabel = (difficulty: 'Beginner' | 'Middle' | 'Senior' | null) => {
    if (!difficulty) return 'Не указан';
    switch (difficulty) {
      case 'Beginner': return 'Для начинающих';
      case 'Middle': return 'Средний уровень';
      case 'Senior': return 'Продвинутый'; // Shorter
      default: return difficulty;
    }
  };

  return (
    <div className="h-full">
      <Link to={isAuthenticated ? `/courses/${course.id}` : '#'} className="block h-full group">
        <div className="card bg-gray-300 relative overflow-hidden rounded-2xl h-52 sm:h-56 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
          <img
            src={course.coverUrl || '/images/courses/default.png'} // Fallback
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent rounded-2xl" />
          <div className="absolute inset-0 z-10 p-4 flex flex-col justify-between text-white">
            <div>
              <div className="mb-1 text-xs opacity-90">{course.authorName}</div>
              <h3 className="text-base sm:text-lg font-semibold leading-tight line-clamp-2">
                {course.title}
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-xs sm:text-sm opacity-90">
              {course.stats.avgRating > 0 && (
                <div className="flex items-center">
                  <span className="text-yellow-400 mr-1">★</span>
                  <span>{course.stats.avgRating.toFixed(1)}</span>
                </div>
              )}
              {course.estimatedDuration && (
                <div className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                    <path d="M12 8V12L15 15" strokeWidth="2" strokeLinecap="round" /> <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  </svg>
                  <span>{course.estimatedDuration} ч</span>
                </div>
              )}
              {course.difficulty && (
                <div className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                    <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">{getDifficultyLabel(course.difficulty)}</span>
                  <span className="sm:hidden">{course.difficulty}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CourseCard;