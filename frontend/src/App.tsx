import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage'; // Updated import
import ProfilePage from './pages/ProfilePage';
import { useAuth } from './hooks/useAuth';

// Placeholder pages
const AboutPage = () => <div className="py-12 text-center">Страница "О нас" в разработке</div>;
const CreateCoursePage = () => <div className="py-12 text-center">Страница создания курса в разработке</div>;

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    // Instead of redirecting to "/", which is now HomePage,
    // you might want to open the AuthModal or redirect to a dedicated login page if you create one.
    // For now, keeping it simple:
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const NotFoundPage = () => (
  <div className="py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <a href="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</a>
  </div>
);

export default function App() {
  const { isLoading } = useAuth(); // Auth loading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} /> {/* Changed to HomePage */}
          {/* <Route path="/features" element={<FeaturesPage />} /> // Removed as per original image */}
          <Route path="/about" element={<AboutPage />} />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-course" 
            element={
              <ProtectedRoute>
                <CreateCoursePage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}