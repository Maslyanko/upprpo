// ==== File: frontend/src/App.tsx ====
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CreateCoursePage from './pages/CreateCoursePage';
import EditCourseContentPage from './pages/EditCourseContentPage';
import { useAuth } from './hooks/useAuth';

const AboutPage = () => <div className="container mx-auto py-12 text-center">Страница "О нас" в разработке</div>;

const CourseDetailPagePlaceholder = () => {
    const { courseId } = useParams();
    return <div className="container mx-auto py-12 text-center">Детали курса: {courseId} (в разработке)</div>;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>; // Можно просто <> </> если нет других wrapper-элементов
};

// ИСПРАВЛЕНИЕ ЗДЕСЬ:
// Убедитесь, что NotFoundPage правильно возвращает JSX.
// Если это однострочный JSX, то круглые скобки обязательны.
// Если многострочный или с логикой, то фигурные скобки и return.
const NotFoundPage = () => (
  <div className="container mx-auto py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <Link to="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</Link> {/* Заменил <a> на <Link> */}
  </div>
); // <--- Закрывающая скобка для JSX

export default function App() {
  const { isLoading: isAuthGlobalLoading } = useAuth();

  if (isAuthGlobalLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600"></div>
        <p className="ml-4 text-lg text-gray-700">Загрузка приложения...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/profile"
            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/profile/edit"
            element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/create-course" // Для создания нового курса (без :courseId)
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
           <Route
            path="/courses/:courseId/edit-facade" // Для редактирования "фасада" существующего курса
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
          <Route
            path="/courses/:courseId/edit-content" // Для редактирования уроков существующего курса
            element={<ProtectedRoute><EditCourseContentPage /></ProtectedRoute>}
          />
          <Route
            path="/courses/:courseId" // Для просмотра страницы деталей курса
            element={<CourseDetailPagePlaceholder />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}