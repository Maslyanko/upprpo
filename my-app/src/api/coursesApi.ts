import client from './client';
import type { Course } from '../types/Course';

// Изменить на false для использования настоящего API
const USE_MOCK_DATA = false; 

interface CourseParams {
  search?: string;
  sort?: 'popularity' | 'difficulty' | 'duration';
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
}

export async function getCourses(params?: CourseParams): Promise<Course[]> {
  if (USE_MOCK_DATA) {
    // Здесь оставим мок-реализацию для возможности разработки без бэкенда
    const { mockCourses } = await import('./mockData');
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        let filteredCourses = [...mockCourses];
        
        // Apply filters
        if (params?.search) {
          const searchLower = params.search.toLowerCase();
          filteredCourses = filteredCourses.filter(
            course => 
              course.title.toLowerCase().includes(searchLower) || 
              course.authorName.toLowerCase().includes(searchLower) ||
              course.tags.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        
        if (params?.level) {
          filteredCourses = filteredCourses.filter(
            course => course.difficulty === params.level
          );
        }
        
        if (params?.language) {
          filteredCourses = filteredCourses.filter(
            course => course.language === params.language
          );
        }
        
        // Apply sorting
        if (params?.sort) {
          switch (params.sort) {
            case 'popularity':
              filteredCourses = filteredCourses.sort(
                (a, b) => b.stats.enrollments - a.stats.enrollments
              );
              break;
            case 'difficulty':
              // Sort by difficulty level (Beginner → Middle → Senior)
              const difficultyOrder = { 'Beginner': 1, 'Middle': 2, 'Senior': 3 };
              filteredCourses = filteredCourses.sort(
                (a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
              );
              break;
            case 'duration':
              filteredCourses = filteredCourses.sort(
                (a, b) => b.estimatedDuration - a.estimatedDuration
              );
              break;
          }
        }
        
        resolve(filteredCourses);
      }, 600); // Simulate a short delay
    });
  } else {
    // Real API call
    const apiParams: Record<string, string | string[]> = {};
    
    // Map frontend params to API params
    if (params?.search) apiParams.search = params.search;
    if (params?.sort) apiParams.sort = params.sort;
    if (params?.level) apiParams.difficulty = params.level; // Изменено на difficulty согласно API
    if (params?.language) apiParams.language = params.language;
    if (params?.tags) apiParams.tags = params.tags;
    
    const response = await client.get<Course[]>('/courses', { params: apiParams });
    return response.data;
  }
}

export async function getCourseById(id: string): Promise<Course> {
  if (USE_MOCK_DATA) {
    const { mockCourses } = await import('./mockData');
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const course = mockCourses.find(c => c.id === id);
        if (course) {
          resolve(course);
        } else {
          reject(new Error('Course not found'));
        }
      }, 300);
    });
  } else {
    const response = await client.get<Course>(`/courses/${id}`);
    return response.data;
  }
}

export async function enrollCourse(courseId: string) {
  if (USE_MOCK_DATA) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, courseId });
      }, 500);
    });
  } else {
    const response = await client.post(`/courses/${courseId}/enroll`);
    return response.data;
  }
}

export async function rateCourse(courseId: string, value: number) {
  if (USE_MOCK_DATA) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, courseId, value });
      }, 500);
    });
  } else {
    const response = await client.post(`/courses/${courseId}/rating`, { value });
    return response.data;
  }
}