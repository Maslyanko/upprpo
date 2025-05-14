// ==== File: frontend/src/components/Navbar.tsx ====
// ===== ./src/components/Navbar.tsx =====
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import AuthModal from './AuthModal';
import { useAuth } from '../hooks/useAuth';

const Navbar: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      if (isHomePage) {
        setIsScrolled(window.scrollY > 50); // Change style after 50px scroll
      } else {
        setIsScrolled(true); // Other pages always have the "scrolled" navbar style
      }
    };

    // Set initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const navClasses = isHomePage && !isScrolled
    ? 'bg-orange text-white' // Use default orange from config
    : 'bg-white text-gray-900 shadow-sm';

  const logoColor = isHomePage && !isScrolled ? 'text-white' : 'text-gray-900';

  const linkBaseClasses = 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200';
  const getLinkClasses = (isActive: boolean) => {
    if (isHomePage && !isScrolled) {
      return `${linkBaseClasses} ${isActive ? 'border-white font-semibold' : 'border-transparent text-orange-50 hover:text-white'}`;
    }
    return `${linkBaseClasses} ${isActive ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
  };

  const authButtonClasses = `flex items-center transition-colors focus:outline-none text-sm font-medium ${
    isHomePage && !isScrolled
      ? 'text-orange-50 hover:text-white'
      : 'text-gray-700 hover:text-orange-500'
  }`;

  const mobileMenuIconColor = isHomePage && !isScrolled ? 'text-white hover:bg-orange-700' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100';
  const mobilePanelClasses = isHomePage && !isScrolled ? 'bg-orange text-white' : 'bg-white text-gray-900'; // Use default orange

  const getMobileLinkClasses = (isActive: boolean) => {
    if (isHomePage && !isScrolled) {
      return `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${isActive ? 'bg-orange-700 border-white text-white' : 'border-transparent text-orange-50 hover:bg-orange-700 hover:text-white'}`;
    }
    return `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${isActive ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}`;
  };


  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navClasses}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Левая часть: Логотип */}
            <div className="flex-shrink-0 flex items-center">
              <NavLink to="/" className="flex items-center">
                <span className={`text-2xl font-bold ${logoColor}`}>AI-Hunt</span>
              </NavLink>
            </div>

            {/* Центральная часть: Навигационные ссылки (только для десктопа) */}
            <div className="hidden sm:flex sm:items-center sm:space-x-8">
              <NavLink to="/about" className={({ isActive }) => getLinkClasses(isActive)}>
                О нас
              </NavLink>
              <NavLink
                to="/"
                className={({ isActive }) => {
                  const visuallyActive = isHomePage ? false : isActive;
                  return getLinkClasses(visuallyActive);
                }}
              >
                Курсы
              </NavLink>
              {user && (
                <NavLink to="/create-course" className={({ isActive }) => getLinkClasses(isActive)}>
                  Создать курс
                </NavLink>
              )}
            </div>

            {/* Правая часть: Профиль/Войти (только для десктопа) */}
            <div className="hidden sm:flex sm:items-center">
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className={authButtonClasses}>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName || 'Profile'}
                        className="w-8 h-8 rounded-full object-cover mr-2"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${isHomePage && !isScrolled ? 'bg-orange-500' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="font-medium">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                    Профиль
                  </Link>
                  <button onClick={logout} className={authButtonClasses}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Выйти
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAuthModalOpen(true)} className={authButtonClasses}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1 ${isHomePage && !isScrolled ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.807.66 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Войти
                </button>
              )}
            </div>

            {/* Кнопка мобильного меню (только для мобильных) */}
            {/* Этот блок будет справа на мобильных, т.к. центральный блок скрыт */}
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`inline-flex items-center justify-center p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 ${mobileMenuIconColor}`}
                aria-expanded="false"
              >
                <span className="sr-only">{isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}</span>
                <svg className="block h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" strokeWidth="2">
                  {isMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Выпадающее мобильное меню */}
        {isMenuOpen && (
          <div className={`sm:hidden ${mobilePanelClasses}`}>
            <div className="pt-2 pb-3 space-y-1">
              <NavLink to="/about" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                О нас
              </NavLink>
              <NavLink 
                to="/" 
                className={({ isActive }) => {
                    const visuallyActive = isHomePage ? false : isActive;
                    return getMobileLinkClasses(visuallyActive);
                }} 
                onClick={() => setIsMenuOpen(false)}
               >
                Курсы
              </NavLink>
              {user && (
                <NavLink to="/create-course" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                  Создать курс
                </NavLink>
              )}
            </div>
            <div className={`pt-4 pb-3 border-t ${isHomePage && !isScrolled ? 'border-orange-500' : 'border-gray-200'}`}>
              {user ? (
                <div>
                  <div className="flex items-center px-4">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName || 'Profile'} className="h-10 w-10 rounded-full object-cover"/>
                    ) : (
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isHomePage && !isScrolled ? 'bg-orange-500' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="font-medium">{user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}</span>
                      </div>
                    )}
                    <div className="ml-3">
                      <div className={`text-base font-medium ${isHomePage && !isScrolled ? 'text-white' : 'text-gray-800'}`}>{user.fullName}</div>
                      <div className={`text-sm font-medium ${isHomePage && !isScrolled ? 'text-orange-100' : 'text-gray-500'}`}>{user.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link
                      to="/profile"
                      className={`block px-4 py-2 text-base font-medium ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Профиль
                    </Link>
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className={`block w-full text-left px-4 py-2 text-base font-medium ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                    >
                      Выйти
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4">
                  <button
                    onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                    className={`block text-base font-medium w-full text-left px-4 py-2 ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                  >
                    Войти
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};

export default Navbar;