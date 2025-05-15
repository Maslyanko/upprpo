// ==== File: frontend/src/hooks/useAuth.ts ====
import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/authApi';
// It's good practice to also fetch user data on initial load if token exists,
// to verify token and get fresh user data.
import { getCurrentUser } from '../api/userApi'; // Import getCurrentUser
import type { User } from '../types/User';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial auth state loading AND token verification

  useEffect(() => {
    const verifyTokenAndFetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // console.log("useAuth: Token found, verifying and fetching user..."); // DEBUG
          const freshUser = await getCurrentUser(); // Fetches /users/me using the token
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser)); // Update stored user
          // console.log("useAuth: User fetched successfully", freshUser); // DEBUG
        } catch (error) {
          // console.error("useAuth: Token verification/user fetch failed", error); // DEBUG
          // Token might be invalid or expired
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        // console.log("useAuth: No token found."); // DEBUG
        // No token, ensure user is null if there was any stale data
        setUser(null);
        localStorage.removeItem('user'); // Clean up potentially stale user data if token is gone
      }
      setIsLoading(false);
    };

    verifyTokenAndFetchUser();
  }, []); // Runs once on mount

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true); // Indicate loading during login process
    try {
      const userData = await apiLogin({ email, password });
      setUser(userData);
      // localStorage is handled by apiLogin
      setIsLoading(false);
      return userData;
    } catch (error) {
      setUser(null);
      setIsLoading(false);
      console.error('useAuth login error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string): Promise<User> => {
    setIsLoading(true); // Indicate loading
    try {
      const userData = await apiRegister({ email, password, fullName });
      setUser(userData);
      // localStorage is handled by apiRegister
      setIsLoading(false);
      return userData;
    } catch (error) {
      setUser(null);
      setIsLoading(false);
      console.error('useAuth register error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout(); // Handles localStorage
    setUser(null);
    // No need to setIsLoading here unless logout involves async operations.
    // Redirect is handled by apiLogout or component.
  }, []);

  const updateUserState = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  return {
    user,
    isLoading, // True while checking auth token or during login/register
    login,
    register,
    logout,
    updateUserState,
    isAuthenticated: !!user && !!localStorage.getItem('token'),
  };
}