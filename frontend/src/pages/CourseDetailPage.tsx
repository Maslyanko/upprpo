// ==== File: frontend/src/pages/CourseDetailPage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCourseById, enrollCourseApi, rateCourseApi } from '@/api/coursesApi';
import { useAuth } from '@/hooks/useAuth';
import type { Course, LessonSummary, LessonEditable } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import client from '@/api/client'; // <<< ИСПРАВЛЕНИЕ: Стандартный импорт

const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [userComment, setUserComment] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  
  const [enrollmentInfo, setEnrollmentInfo] = useState<{isEnrolled: boolean, progress: number} | null>(null);

  const fetchCourseAndEnrollmentData = useCallback(async () => {
    if (!courseId) {
      setError("ID курса не указан."); setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
    try {
      const courseData = await getCourseById(courseId);
      setCourse(courseData);
      document.title = `${courseData.title || 'Курс'} - AI-Hunt`;

      if (isAuthenticated && user) {
        try {
          // Используем импортированный client
          const progressResponse = await client.get(`/courses/${courseId}/progress`);
          if (progressResponse.data) {
            setEnrollmentInfo({ isEnrolled: true, progress: progressResponse.data.progress || 0 });
          } else { // This case might not be hit if API 404s for no progress
            setEnrollmentInfo({ isEnrolled: false, progress: 0 });
          }
        } catch (progressError: any) {
          if (progressError.response?.status === 404) {
            setEnrollmentInfo({ isEnrolled: false, progress: 0 }); 
          } else {
            console.warn("Could not fetch enrollment progress:", progressError);
            // Set to null or a default state if progress can't be determined
            // Forcing isEnrolled: false might be incorrect if it's a network error for an enrolled user
            setEnrollmentInfo(null); // Indicates an unknown enrollment state due to error
          }
        }
      } else {
        setEnrollmentInfo({ isEnrolled: false, progress: 0 }); 
      }

    } catch (err: any) {
      console.error("Error fetching course details:", err);
      if (err.response?.status === 404) { setError("Курс не найден."); } 
      else { setError("Не удалось загрузить информацию о курсе. " + (err.message || "")); }
      setCourse(null);
      setEnrollmentInfo(null); // Reset on course fetch error
    } finally {
      setIsLoading(false);
    }
  }, [courseId, isAuthenticated, user]); // Removed 'client' from here as it's stable

  useEffect(() => {
    fetchCourseAndEnrollmentData();
  }, [fetchCourseAndEnrollmentData]);

  const handleEnroll = async () => {
    if (!courseId || !isAuthenticated) {
      alert("Пожалуйста, войдите в систему, чтобы записаться на курс."); return;
    }
    setIsEnrolling(true); setError(null);
    try {
      const enrollmentData = await enrollCourseApi(courseId);
      if (enrollmentData) { 
        setEnrollmentInfo({isEnrolled: true, progress: enrollmentData.progress || 0});
        if (enrollmentData.alreadyEnrolled) {
            // No alert, just navigate. Backend `enrollCourse` model now returns existing enrollment with a flag.
            // Controller `enrollCourse` also handles this by returning 200 with existing data.
        }
        navigate(`/learn/courses/${courseId}`);
      }
    } catch (err: any) {
      // This catch block in handleEnroll might now be less critical if enrollCourseApi
      // handles "already enrolled" gracefully by not throwing an error.
      // However, other API errors (e.g., 500 from backend) could still occur.
      setError(err.response?.data?.message || "Ошибка при записи на курс.");
    } finally {
      setIsEnrolling(false);
    }
  };
  
  const handleRateCourse = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!courseId || !userRating || userRating < 1 || userRating > 5) {
          setError("Пожалуйста, выберите оценку от 1 до 5."); return;
      }
      setIsSubmittingRating(true); setError(null);
      try {
          await rateCourseApi(courseId, userRating, userComment);
          alert("Спасибо за вашу оценку!");
          fetchCourseAndEnrollmentData(); 
      } catch (err: any) {
          setError(err.response?.data?.message || "Ошибка при отправке оценки.");
      } finally {
          setIsSubmittingRating(false);
      }
  };

  if (authLoading || isLoading || (isAuthenticated && enrollmentInfo === null && !error && !isLoading)) { 
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3 text-gray-700">Загрузка курса...</p></div>;
  }

  if (error && !course) { // If there's an error and no course data, show error message
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">{error}</p><Link to="/" className="mt-4 btn-primary">На главную</Link></div>;
  }

  if (!course) { // If no error but still no course (e.g. successful API call returning null)
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-gray-600 text-lg">Информация о курсе не найдена.</p></div>;
  }

  const difficultyLabel = course.difficulty ? {
    'Beginner': 'Для начинающих',
    'Middle': 'Средний уровень',
    'Senior': 'Продвинутый'
  }[course.difficulty] || course.difficulty : 'Не указан';

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              <img 
                src={course.coverUrl || '/images/courses/default.png'} 
                alt={course.title} 
                className="w-full h-auto object-cover rounded-md shadow-md aspect-[16/9]"
              />
            </div>
            <div className="md:w-2/3">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{course.title}</h1>
              <p className="text-sm text-gray-500 mb-1">Автор: {course.authorName}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
                <span>Сложность: <span className="font-medium">{difficultyLabel}</span></span>
                {course.language && <span>Язык: <span className="font-medium">{course.language}</span></span>}
                {course.estimatedDuration && <span>~ {course.estimatedDuration} ч.</span>}
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-700 mb-4">
                {course.stats.avgRating > 0 && (
                  <span className="flex items-center"><svg className="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg> {course.stats.avgRating.toFixed(1)}/5</span>
                )}
                <span>{course.stats.enrollments} студентов</span>
              </div>
              
              {isAuthenticated ? (
                enrollmentInfo?.isEnrolled ? (
                  <Link 
                    to={`/learn/courses/${courseId}`} 
                    className="btn-success w-full sm:w-auto text-center"
                  >
                    Продолжить обучение ({enrollmentInfo.progress}%)
                  </Link>
                ) : (
                  <button 
                    onClick={handleEnroll} 
                    disabled={isEnrolling || enrollmentInfo === null} // Disable if enrollment status unknown
                    className="btn-primary w-full sm:w-auto"
                  >
                    {isEnrolling ? 'Запись...' : 'Записаться на курс'}
                  </button>
                )
              ) : (
                 <p className="text-sm text-gray-600 p-3 bg-orange-50 rounded-md border border-orange-200">
                    <button onClick={(e) => { e.preventDefault(); /* TODO: Trigger AuthModal from Navbar here */ alert('Пожалуйста, войдите или зарегистрируйтесь, чтобы записаться на курс.');}} className="text-orange-600 font-semibold hover:underline">Войдите</button>, чтобы записаться на курс.
                 </p>
              )}
            </div>
          </div>
        </div>
        
        {error && !isLoading && course && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center" role="alert">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow border">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Описание курса</h2>
            {course.description ? (
              <div className="prose prose-sm sm:prose max-w-none text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{course.description}</ReactMarkdown>
              </div>
            ) : <p className="text-gray-600 italic">Описание курса отсутствует.</p>}
          </div>

          <div className="md:col-span-1 bg-white p-6 rounded-lg shadow border">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Содержание курса</h2>
            {course.lessons && course.lessons.length > 0 ? (
              <ul className="space-y-2">
                {(course.lessons as Array<LessonSummary | LessonEditable>).map((lesson, index) => (
                  <li key={lesson.id} className="text-gray-700 text-sm p-2 rounded bg-gray-50 border border-gray-200">
                    {index + 1}. {lesson.title} 
                    {isAuthenticated && enrollmentInfo?.isEnrolled && lesson.completedByUser && <span className="text-green-500 ml-1">✓</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 italic">Содержание курса скоро появится.</p>
            )}
          </div>
        </div>

        {isAuthenticated && enrollmentInfo?.isEnrolled && enrollmentInfo?.progress === 100 && (
            <div className="mt-8 bg-white p-6 rounded-lg shadow border">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Оцените курс</h2>
                <form onSubmit={handleRateCourse} className="space-y-4">
                    <div>
                        <label htmlFor="ratingValue" className="block text-sm font-medium text-gray-700">Ваша оценка (1-5):</label>
                        <select 
                            id="ratingValue" 
                            value={userRating || ''} 
                            onChange={(e) => setUserRating(parseInt(e.target.value))}
                            className="form-select mt-1 block w-full sm:w-1/3"
                            required
                        >
                            <option value="" disabled>Выберите...</option>
                            {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="ratingComment" className="block text-sm font-medium text-gray-700">Комментарий (необязательно):</label>
                        <textarea 
                            id="ratingComment" 
                            value={userComment} 
                            onChange={(e) => setUserComment(e.target.value)}
                            rows={3}
                            className="form-textarea mt-1 block w-full"
                        ></textarea>
                    </div>
                    <button type="submit" disabled={isSubmittingRating} className="btn-primary">
                        {isSubmittingRating ? "Отправка..." : "Отправить оценку"}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  );
};

export default CourseDetailPage;