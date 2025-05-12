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

interface AuthTokenResponse {
  accessToken: string;
}

export async function login(data: LoginData): Promise<User> {
  try {
    // Get token
    const response = await client.post<AuthTokenResponse>('/auth/login', data);
    const { accessToken } = response.data;
    localStorage.setItem('token', accessToken);
    
    // Get user information
    const userResponse = await client.get<User>('/users/me');
    localStorage.setItem('user', JSON.stringify(userResponse.data));
    
    return userResponse.data;
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
}

export async function register(data: RegisterData): Promise<User> {
  try {
    // Register user
    await client.post('/auth/register', {
      email: data.email,
      password: data.password,
      fullName: data.fullName
    });

    // Login after registration
    const loginResponse = await client.post<AuthTokenResponse>('/auth/login', {
      email: data.email,
      password: data.password
    });
    
    const { accessToken } = loginResponse.data;
    localStorage.setItem('token', accessToken);

    // Update profile with full name
    const userResponse = await client.patch<User>('/users/me', {
      fullName: data.fullName
    });
    
    localStorage.setItem('user', JSON.stringify(userResponse.data));
    return userResponse.data;
  } catch (error) {
    console.error('Register API error:', error);
    throw error;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Force refresh to reset application state
  window.location.href = '/';
}