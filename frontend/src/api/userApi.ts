// ==== File: frontend/src/api/userApi.ts ====
import client from './client';
import type { User } from '../types/User';
import type { Course } from '../types/Course';
import { mapApiCourseToFrontendCourse } from './coursesApi'; // Import the mapper

interface UpdateProfileData {
  fullName?: string;
  // avatarUrl is handled by uploadAvatar which then calls updateProfile internally or separately
}

export interface EnrollmentWithCourseAPI { // Raw from API
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null;
    course: any; // Raw course data from API
}

export interface EnrollmentWithCourseMapped { // Mapped for frontend use
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null;
    course: Course; // Mapped course data
}


export async function getCurrentUser(): Promise<User> {
  try {
    const response = await client.get<User>('/users/me'); // Assumes backend returns User type directly
    return response.data;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

export async function updateProfile(data: UpdateProfileData): Promise<User> {
  try {
    const response = await client.patch<User>('/users/me', data);
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

export async function uploadAvatar(formData: FormData): Promise<{ avatarUrl: string, user: User }> {
  try {
    // Backend now returns the updated user object along with avatarUrl
    const response = await client.post<{ avatarUrl: string, user: User }>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    // Update local storage with the full updated user from the response
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data; // Contains avatarUrl and the updated user object
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}


export async function getMyEnrollments(status: 'inProgress' | 'completed'): Promise<EnrollmentWithCourseMapped[]> {
  try {
    const response = await client.get<EnrollmentWithCourseAPI[]>('/users/me/enrollments', {
      params: { status }
    });
    return response.data.map(enrollment => ({
        ...enrollment,
        course: mapApiCourseToFrontendCourse(enrollment.course)
    }));
  } catch (error) {
    console.error(`Error getting enrollments for status ${status}:`, error);
    throw error;
  }
}

export async function getMyCreatedCourses(): Promise<Course[]> {
  try {
    const response = await client.get<any[]>('/users/me/courses');
    return response.data.map(mapApiCourseToFrontendCourse);
  } catch (error) {
    console.error('Error getting created courses:', error);
    throw error;
  }
}