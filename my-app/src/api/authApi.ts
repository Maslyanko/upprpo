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
  // Получаем токен
  const response = await client.post<AuthTokenResponse>('/auth/login', data);
  const { accessToken } = response.data;
  localStorage.setItem('token', accessToken);
  
  // Получаем информацию о пользователе
  const userResponse = await client.get<User>('/users/me');
  localStorage.setItem('user', JSON.stringify(userResponse.data));
  
  return userResponse.data;
}

export async function register(data: RegisterData): Promise<User> {
  // Регистрируем пользователя
  await client.post('/auth/register', {
    email: data.email,
    password: data.password,
    fullName: data.fullName
  });

  // Затем выполняем вход
  const loginResponse = await client.post<AuthTokenResponse>('/auth/login', {
    email: data.email,
    password: data.password
  });
  
  const { accessToken } = loginResponse.data;
  localStorage.setItem('token', accessToken);

  // Обновляем профиль с ФИО
  const userResponse = await client.patch<User>('/users/me', {
    fullName: data.fullName
  });
  
  localStorage.setItem('user', JSON.stringify(userResponse.data));
  return userResponse.data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}