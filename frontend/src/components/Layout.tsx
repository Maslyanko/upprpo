import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col"> {/* Removed bg-gray-50 */}
      <Navbar />
      {/* pt-16 is h-16 for navbar height */}
      <main className="flex-grow w-full pt-16"> 
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
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