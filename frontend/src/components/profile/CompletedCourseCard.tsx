// ===== ./src/components/profile/CompletedCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '../../api/userApi'; // Adjust path if needed

interface CompletedCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const CompletedCourseCard: React.FC<CompletedCourseCardProps> = ({ enrollment }) => {
  const { course, userRating } = enrollment;
  // Determine result text - Placeholder, adapt if backend provides specific score
   const resultText = userRating ? `Ваша оценка: ${userRating}/5` : 'Курс завершен';

  return (
    <div className="bg-white rounded-lg shadow-card p-5 flex flex-col justify-between h-full">
        <div>
            <p className="text-xs text-gray-500 mb-1">{course.authorName}</p>
             <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2">{course.title}</h3>
            <p className="text-sm font-medium text-orange-600">{resultText}</p>
        </div>
         {/* Optional: Add a button to view certificate or review */}
        <Link
            to={`/courses/${course.id}/review`} // Example link, adjust as needed
            className="block w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 text-center rounded-md hover:bg-gray-300 transition-colors font-medium text-sm"
        >
            Посмотреть
        </Link>
    </div>
  );
};

export default CompletedCourseCard;