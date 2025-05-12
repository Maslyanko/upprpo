// ===== ./frontend/src/components/AuthModal.tsx =====
import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom'; // Можно использовать вместо window.location
import { useAuth } from '../hooks/useAuth'; // Убедись, что путь верный

// SVG иконки для удобства (можно вынести в отдельные файлы)
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
);

const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
);


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const navigate = useNavigate(); // Альтернатива window.location.reload

  // Состояние для видимости пароля
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Определяем, активна ли кнопка отправки
  const isSubmitDisabled = isLoading || (isLoginMode
      ? (!email || !password) // Условие для входа
      : (!fullName || !email || !password || !confirmPassword || password !== confirmPassword || password.length < 8) // Условие для регистрации
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return; // Не отправлять, если кнопка неактивна

    setIsLoading(true);
    setError('');

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        // Проверка паролей уже в isSubmitDisabled, но можно оставить для надежности
        if (password !== confirmPassword) throw new Error('Пароли не совпадают');
        if (password.length < 8) throw new Error('Пароль должен быть не менее 8 символов');
        await register(email, password, fullName);
      }

      onLoginSuccess();
      onClose();

      // Перезагрузка для обновления состояния (можно заменить на navigate('/') если используется React Router)
      window.location.reload(); // Или window.location.href = '/';
    } catch (err) {
        // Форматируем сообщение об ошибке
        if (err instanceof Error) {
            if ((err as any).response?.data?.code === 'INVALID_CREDENTIALS') {
                setError('Неверный email или пароль');
            } else if ((err as any).response?.data?.code === 'EMAIL_EXISTS') {
                setError('Пользователь с таким email уже существует');
            } else {
                setError(err.message);
            }
        } else {
           setError('Произошла неизвестная ошибка');
        }
      console.error("Auth Error:", err); // Логируем полную ошибку
    } finally {
      setIsLoading(false);
    }
  };

  // Сброс полей при смене режима
  const handleModeSwitch = (switchToLogin: boolean) => {
    setIsLoginMode(switchToLogin);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (!isOpen) return null;

  return (
    // Оверлей
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
      {/* Карточка модального окна */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">

        {/* Опциональный лоадер */}
        {isLoading && (
             <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
             </div>
        )}

        {/* Контент */}
        <div className="p-8">
          {/* Хедер с логотипом и кнопкой назад (для регистрации) */}
          <div className="relative flex justify-center items-center mb-6 h-8">
            {!isLoginMode && (
              <button
                type="button"
                onClick={() => handleModeSwitch(true)} // Переключиться на вход
                className="absolute left-0 text-gray-500 hover:text-gray-800"
                aria-label="Назад ко входу"
              >
                <BackArrowIcon />
              </button>
            )}
            <span className="text-2xl font-bold text-orange-600">AI-Hunt</span>
             {/* Кнопка закрытия (если нужна именно внутри, а не только по клику на оверлей) */}
            <button
                onClick={onClose}
                className="absolute right-0 text-gray-400 hover:text-gray-600"
                aria-label="Закрыть окно"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
          </div>

          {/* Заголовок */}
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
            {isLoginMode ? 'Вход в профиль' : 'Регистрация'}
          </h2>

          {/* Сообщение об ошибке */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Поле ФИО (только для регистрации) */}
            {!isLoginMode && (
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm"
                  required={!isLoginMode}
                  placeholder="ФИО"
                  aria-label="ФИО"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Поле Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm"
                required
                placeholder="Электронная почта"
                aria-label="Электронная почта"
                disabled={isLoading}
              />
            </div>

            {/* Поле Пароль */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm pr-10" // Добавляем padding справа для иконки
                required
                minLength={8}
                placeholder="Пароль"
                aria-label="Пароль"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>

             {/* Ссылка "Не помню пароль" (только для входа) */}
             {isLoginMode && (
                 <div className="text-right">
                    <button type="button" className="text-sm text-gray-500 hover:text-orange-600 hover:underline">
                        Не помню пароль
                    </button>
                 </div>
             )}


            {/* Поле Подтверждение пароля (только для регистрации) */}
            {!isLoginMode && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm pr-10"
                  required={!isLoginMode}
                  minLength={8}
                  placeholder="Подтвердите пароль"
                  aria-label="Подтверждение пароля"
                  disabled={isLoading}
                />
                 <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                 >
                    {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                 </button>
              </div>
            )}

            {/* Кнопка Отправки */}
            <button
              type="submit"
              disabled={isSubmitDisabled} // Используем вычисленное состояние
              className={`w-full text-white py-3 px-4 rounded-lg transition-colors duration-200 font-semibold text-sm ${
                  isSubmitDisabled
                  ? 'bg-gray-300 cursor-not-allowed' // Стиль неактивной кнопки
                  : 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500' // Стиль активной кнопки
              }`}
            >
              {isLoading ? 'Подождите...' : (isLoginMode ? 'Войти' : 'Зарегистрироваться')}
            </button>

            {/* Кнопка переключения режима / создания профиля */}
            {isLoginMode ? (
                 <button
                    type="button"
                    onClick={() => handleModeSwitch(false)} // Переключиться на регистрацию
                    disabled={isLoading}
                    className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-semibold text-sm"
                >
                    Создать профиль
                </button>
            ) : (
                 <div className="text-center text-sm">
                    <span className="text-gray-500">Уже есть аккаунт? </span>
                    <button
                        type="button"
                        onClick={() => handleModeSwitch(true)} // Переключиться на вход
                        disabled={isLoading}
                        className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                    >
                         Войти
                    </button>
                 </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;