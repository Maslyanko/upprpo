import { useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/authApi';
import type { User } from '../types/User';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }
    setIsLoading(false);
  }, []);

  // Функция для входа по email и паролю
  const login = async (emailOrUser: string | User, password?: string): Promise<User> => {
    // Если первый аргумент - объект User, то просто обновляем состояние
    if (typeof emailOrUser === 'object') {
      setUser(emailOrUser);
      return emailOrUser;
    }
    
    // Иначе выполняем вход с email и password
    const userData = await apiLogin({ email: emailOrUser, password: password! });
    setUser(userData);
    return userData;
  };

  const register = async (email: string, password: string, fullName: string): Promise<User> => {
    const userData = await apiRegister({ email, password, fullName });
    setUser(userData);
    return userData;
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  // Функция для обновления состояния пользователя (без API-запроса)
  const updateUserState = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    updateUserState,
    isAuthenticated: !!user
  };
}