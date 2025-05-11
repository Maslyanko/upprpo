import { useState, useEffect } from 'react';
import { login, register, logout as apiLogout } from '../api/authApi';
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

  const handleLogin = async (email: string, password: string) => {
    const userData = await login({ email, password });
    setUser(userData);
    return userData;
  };

  const handleRegister = async (email: string, password: string, fullName: string) => {
    const userData = await register({ email, password, fullName });
    setUser(userData);
    return userData;
  };

  const handleLogout = () => {
    apiLogout();
    setUser(null);
  };

  return {
    user,
    isLoading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    isAuthenticated: !!user
  };
}