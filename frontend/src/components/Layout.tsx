// ===== ./frontend/src/components/Layout.tsx =====
import React from 'react';
import Navbar from './Navbar'; // Убедись, что путь верный

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    // Основной контейнер с фоном и минимальной высотой
    <div className="min-h-screen flex flex-col bg-gray-50"> {/* Или твой основной фон, например bg-[#f9f9f9] */}
      <Navbar />

      {/* Контейнер для основного контента страницы */}
      {/* ВАЖНО: Добавляем max-w-7xl mx-auto и отступы px-* для ограничения ширины и центрирования */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* py-8 добавляет вертикальные отступы сверху/снизу */}
        {children}
      </main>

      {/* Футер */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto"> {/* mt-auto прижимает футер к низу */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} AI-Hunt. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;