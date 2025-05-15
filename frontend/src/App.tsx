// ==== File: frontend/src/App.tsx ====
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout'; // Check path
import HomePage from './pages/HomePage';   // Check path
import ProfilePage from './pages/ProfilePage'; // Check path
import EditProfilePage from './pages/EditProfilePage'; // Check path
import CreateCoursePage from './pages/CreateCoursePage'; // Check path
import { useAuth } from './hooks/useAuth'; // Check path

// A simple component for AboutPage if it's not complex
const AboutPage = () => <div className="container mx-auto py-12 text-center">Страница "О нас" в разработке</div>;

// Placeholder for a Course Detail Page (add this if you don't have it)
const CourseDetailPagePlaceholder = () => {
    const { courseId } = useParams(); // If you use react-router-dom v6
    return <div className="container mx-auto py-12 text-center">Детали курса: {courseId} (в разработке)</div>;
};
// Placeholder for Edit Course Content Page
const EditCourseContentPagePlaceholder = () => {
    const { courseId } = useParams(); // If you use react-router-dom v6
    return <div className="container mx-auto py-12 text-center">Редактирование контента курса: {courseId} (в разработке)</div>;
};
// Need to import useParams if used
import { useParams } from 'react-router-dom';


const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // console.log('ProtectedRoute: isLoading:', isLoading, 'isAuthenticated:', isAuthenticated); // DEBUG

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // console.log('ProtectedRoute: Not authenticated, redirecting to /'); // DEBUG
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const NotFoundPage = () => (
  <div className="container mx-auto py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <a href="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</a>
  </div>
);

export default function App() {
  const { isLoading: isAuthGlobalLoading, user } = useAuth(); // Get user too for debugging

  // console.log('App.tsx: isAuthGlobalLoading:', isAuthGlobalLoading, 'User:', user); // DEBUG

  // This global loading state should ideally only cover the initial auth check.
  // If it's true for too long, something is wrong in useAuth.
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
          {/* Placeholder routes - you'll need to implement these pages */}
          <Route
            path="/courses/:courseId"
            element={<CourseDetailPagePlaceholder />} // Replace with your actual Course Detail Page
          />
          <Route
            path="/courses/:courseId/edit-content" // As used in CreateCoursePage
            element={<ProtectedRoute><EditCourseContentPagePlaceholder /></ProtectedRoute>} // Replace
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}