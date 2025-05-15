// ==== File: frontend/src/pages/CourseManagementPage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getCourseById, publishCourseApi, deleteCourseApi } from '@/api/coursesApi';
import type { Course } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CourseManagementPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<'' | 'publish' | 'delete'>('');

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setError("ID курса не указан.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const courseData = await getCourseById(courseId);
      setCourse(courseData);
      document.title = `${courseData.title || 'Курс'} - Управление - AI-Hunt`;
    } catch (err) {
      console.error("Error fetching course for management:", err);
      setError("Не удалось загрузить данные курса. " + (err instanceof Error ? err.message : ""));
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handlePublish = async () => {
    if (!course || !course.id || course.isPublished) return;
    setActionInProgress('publish');
    setError(null);
    try {
      const updatedCourse = await publishCourseApi(course.id);
      setCourse(updatedCourse);
    } catch (err) {
      setError("Ошибка публикации курса: " + (err instanceof Error ? err.message : "Проверьте, все ли поля курса заполнены."));
    } finally {
      setActionInProgress('');
    }
  };

  const handleDelete = async () => {
    if (!course || !course.id) return;
    if (window.confirm(`Вы уверены, что хотите удалить курс "${course.title}"? Это действие необратимо.`)) {
      setActionInProgress('delete');
      setError(null);
      try {
        await deleteCourseApi(course.id);
        navigate('/profile'); 
      } catch (err) {
        setError("Ошибка удаления курса: " + (err instanceof Error ? ((err as any).response?.data?.message || err.message) : "Неизвестная ошибка"));
      } finally {
        setActionInProgress('');
      }
    }
  };

  if (isAuthLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  }

  if (!user) { 
    navigate('/');
    return null;
  }
  
  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка курса...</p></div>;
  }

  if (error && !course) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">{error}</p><Link to="/profile" className="mt-4 btn-primary">Вернуться в профиль</Link></div>;
  }

  if (!course) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-gray-600 text-lg">Курс не найден.</p><Link to="/profile" className="mt-4 btn-primary">Вернуться в профиль</Link></div>;
  }

  if (course.authorId !== user.id) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">У вас нет прав для управления этим курсом.</p><Link to="/" className="mt-4 btn-primary">На главную</Link></div>;
  }


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-6">
        <Link to="/profile" className="text-sm text-orange-600 hover:text-orange-700 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Назад в профиль (к моим курсам)
        </Link>
      </div>

      {error && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center" role="alert">{error}</div>}
      
      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        {course.coverUrl && (
          <img src={course.coverUrl} alt={course.title} className="w-full h-64 sm:h-72 md:h-80 object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-0">{course.title}</h1>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full self-start sm:self-center ${course.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {course.isPublished ? `Опубликован (Версия ${course.version || 1})` : 'Черновик'}
            </span>
          </div>

          {course.description && (
            <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 mb-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{course.description}</ReactMarkdown>
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-8">Статистика и информация</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 text-sm">
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Сложность</p>
              <p className="font-semibold text-gray-800">{course.difficulty || 'Не указана'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Язык</p>
              <p className="font-semibold text-gray-800">{course.language || 'Не указан'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Длительность</p>
              <p className="font-semibold text-gray-800">{course.estimatedDuration ? `${course.estimatedDuration} ч.` : 'Не указана'}</p>
            </div>
             <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Записей</p>
              <p className="font-semibold text-gray-800">{course.stats.enrollments}</p>
            </div>
             <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Средний рейтинг</p>
              <p className="font-semibold text-gray-800">{course.stats.avgRating > 0 ? course.stats.avgRating.toFixed(1) + '/5' : 'Нет оценок'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Уроков</p>
              <p className="font-semibold text-gray-800">{Array.isArray(course.lessons) ? course.lessons.length : 0}</p>
            </div>
          </div>
          
          <div className="border-t pt-6 flex flex-wrap justify-start gap-3">
            <Link to={`/courses/${course.id}/edit-facade`} className="btn-primary whitespace-nowrap">
              Редактировать
            </Link>
            {!course.isPublished && (
              <button 
                onClick={handlePublish} 
                disabled={actionInProgress === 'publish'}
                className="btn-success whitespace-nowrap"
              >
                {actionInProgress === 'publish' ? 'Публикация...' : 'Опубликовать курс'}
              </button>
            )}
            <button 
              onClick={handleDelete} 
              disabled={actionInProgress === 'delete'}
              className="btn-danger whitespace-nowrap md:ml-auto" 
            >
              {actionInProgress === 'delete' ? 'Удаление...' : 'Удалить курс'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseManagementPage;