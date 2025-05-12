// ===== ./src/components/profile/ActiveCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '../../api/userApi'; // Adjust path if needed

interface ActiveCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const ActiveCourseCard: React.FC<ActiveCourseCardProps> = ({ enrollment }) => {
  const { course, progress } = enrollment;
  const totalLessons = course.lessons?.length || 1; // Avoid division by zero
  // Assuming progress is 0-100, convert to lessons completed
  const completedLessons = Math.round((progress / 100) * totalLessons);

  return (
    <div className="bg-white rounded-lg shadow-card p-5 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2">{course.title}</h3>
         {/* Progress Bar */}
         <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Прогресс</span>
                <span>{completedLessons}/{totalLessons}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                className="bg-orange-500 h-2 rounded-full"
                style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
      </div>
      <Link
        to={`/courses/${course.id}`} // Link to the course page
        className="block w-full mt-4 px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 transition-colors font-medium text-sm"
      >
        Продолжить
      </Link>
    </div>
  );
};

export default ActiveCourseCard;