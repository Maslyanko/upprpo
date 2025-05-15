// ==== File: frontend/src/App.tsx ====
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, Link } from 'react-router-dom'; // Added Link
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CreateCoursePage from './pages/CreateCoursePage';
import EditCourseContentPage from './pages/EditCourseContentPage';
import CourseManagementPage from './pages/CourseManagementPage'; // NEW IMPORT
import { useAuth } from './hooks/useAuth';

const AboutPage = () => <div className="container mx-auto py-12 text-center">Страница "О нас" в разработке</div>;

const CourseDetailPagePlaceholder = () => {
    const { courseId } = useParams();
    // This could be the public view of the course, or redirect to management if author
    return <div className="container mx-auto py-12 text-center">Просмотр курса: {courseId} (в разработке)</div>;
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
  return <>{children}</>;
};

const NotFoundPage = () => (
  <div className="container mx-auto py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <Link to="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</Link>
  </div>
);

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
            path="/create-course"
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
           <Route
            path="/courses/:courseId/edit-facade"
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
          <Route
            path="/courses/:courseId/edit-content"
            element={<ProtectedRoute><EditCourseContentPage /></ProtectedRoute>}
          />
          {/* Public facing course detail page */}
          <Route
            path="/courses/:courseId" 
            element={<CourseDetailPagePlaceholder />} // Replace with actual public course view later
          />
          {/* Course Management Page for Author */}
          <Route
            path="/courses/:courseId/manage"
            element={<ProtectedRoute><CourseManagementPage /></ProtectedRoute>}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}