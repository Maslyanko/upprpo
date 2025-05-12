import client from './client';
import type { User } from '../types/User';
import type { Course } from '../types/Course'; // Import Course type

interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
}

// Interface for Enrollment data returned by the new endpoint
export interface EnrollmentWithCourse {
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null; // User's rating for completed course
    course: Course; // Full course details
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

/**
 * Get user's enrollments by status
 */
export async function getMyEnrollments(status: 'inProgress' | 'completed'): Promise<EnrollmentWithCourse[]> {
  console.log(`Getting enrollments with status: ${status}`);
  try {
    const response = await client.get<EnrollmentWithCourse[]>('/users/me/enrollments', {
      params: { status }
    });
    console.log(`Enrollments received for status ${status}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error getting enrollments for status ${status}:`, error);
    throw error;
  }
}

/**
 * Get courses created by the user
 */
export async function getMyCreatedCourses(): Promise<Course[]> {
  console.log('Getting created courses');
  try {
    const response = await client.get<Course[]>('/users/me/courses');
    console.log('Created courses received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting created courses:', error);
    throw error;
  }
}