// ==== File: frontend/src/api/authApi.ts ====
import client from './client';
import type { User } from '../types/User';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

interface AuthResponse { // Backend now returns user object along with token
  user: User;
  accessToken: string;
}

export async function login(data: LoginData): Promise<User> {
  try {
    const response = await client.post<AuthResponse>('/auth/login', data);
    const { user, accessToken } = response.data;

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user)); // Store the user object from response

    return user;
  } catch (error) {
    console.error('Login API error:', error);
    // Clear potentially outdated/invalid local storage on critical auth errors
    if ((error as any).response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    throw error;
  }
}

export async function register(data: RegisterData): Promise<User> {
  try {
    // Register user - backend now logs in and returns user + token directly
    const response = await client.post<AuthResponse>('/auth/register', {
      email: data.email,
      password: data.password,
      fullName: data.fullName
    });
    const { user, accessToken } = response.data;

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  } catch (error) {
    console.error('Register API error:', error);
    throw error;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Consider using react-router navigate for SPA-friendly redirection
  window.location.href = '/'; // Force refresh to reset application state
}