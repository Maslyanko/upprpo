// ==== File: frontend/src/App.tsx ====
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import { useAuth } from './hooks/useAuth';

const AboutPage = () => <div className="py-12 text-center">Страница "О нас" в разработке</div>;
const CreateCoursePage = () => <div className="py-12 text-center">Страница создания курса в разработке</div>;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!isAuthenticated) { return <Navigate to="/" replace />; }
  return <>{children}</>;
};

// Fixed NotFoundPage definition
const NotFoundPage = () => (
  <div className="py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <a href="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</a>
  </div>
); // Ensure this is correctly defined and closed

export default function App() {
  const { isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route 
            path="/profile" 
            element={ <ProtectedRoute> <ProfilePage /> </ProtectedRoute> } 
          />
          <Route
            path="/profile/edit"
            element={ <ProtectedRoute> <EditProfilePage /> </ProtectedRoute> }
          />
          <Route 
            path="/create-course" 
            element={ <ProtectedRoute> <CreateCoursePage /> </ProtectedRoute> } 
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}