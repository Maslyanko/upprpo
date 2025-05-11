import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CatalogPage from './pages/CatalogPage';
import ProfilePage from './pages/ProfilePage'; // Добавляем импорт новой страницы
import { useAuth } from './hooks/useAuth';

// Placeholder pages that will be implemented later
const FeaturesPage = () => <div className="py-12 text-center">Страница в разработке</div>;
const AboutPage = () => <div className="py-12 text-center">Страница в разработке</div>;
const CreateCoursePage = () => <div className="py-12 text-center">Страница создания курса в разработке</div>; // Заглушка для страницы создания курса
const NotFoundPage = () => (
  <div className="py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <a href="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</a>
  </div>
);

export default function App() {
  const { isLoading } = useAuth();

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
          <Route path="/" element={<CatalogPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/profile" element={<ProfilePage />} /> {/* Добавляем маршрут для профиля */}
          <Route path="/create-course" element={<CreateCoursePage />} /> {/* Добавляем маршрут для создания курса */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}