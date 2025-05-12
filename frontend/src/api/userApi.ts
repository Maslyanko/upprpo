import client from './client';
import type { User } from '../types/User';

interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
}

/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<User> {
  console.log('Getting current user data');
  try {
    const response = await client.get<User>('/users/me');
    console.log('User data received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  console.log('Updating profile with data:', data);
  try {
    const response = await client.patch<User>('/users/me', data);
    console.log('Profile updated:', response.data);
    
    // Update localStorage
    localStorage.setItem('user', JSON.stringify(response.data));
    
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(formData: FormData): Promise<{ avatarUrl: string }> {
  console.log('Uploading avatar');
  try {
    const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    console.log('Avatar uploaded, new URL:', response.data.avatarUrl);
    return response.data;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}