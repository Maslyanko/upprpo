import client from './client';
import type { User } from '../types/User';

interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
}

/**
 * Получение данных текущего пользователя
 */
export async function getCurrentUser(): Promise<User> {
  const response = await client.get<User>('/users/me');
  return response.data;
}

/**
 * Обновление данных профиля пользователя
 * @param data Данные для обновления
 */
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  const response = await client.patch<User>('/users/me', data);
  
  // Обновляем информацию о пользователе в localStorage
  const user = response.data;
  localStorage.setItem('user', JSON.stringify(user));
  
  return user;
}

/**
 * Загрузка аватара пользователя
 * @param formData FormData с файлом аватара
 */
export async function uploadAvatar(formData: FormData): Promise<{ avatarUrl: string }> {
  const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}