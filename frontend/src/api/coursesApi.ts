// ==== File: frontend/src/api/coursesApi.ts ====
import client from './client';
import type { Course, CourseCreatePayload, CourseFacadePayload } from '../types/Course';
import { getDifficultyFromTags, getLanguageFromTags } from '../types/Course';

const USE_MOCK_DATA = false;

interface ApiCourseParams {
  search?: string;
  sort?: 'popularity' | 'difficulty_order' | 'duration';
  difficulty?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string;
}

// Function to map API course to frontend Course object
// EXPORT THIS FUNCTION
export const mapApiCourseToFrontendCourse = (apiCourse: any): Course => {
  const tags = apiCourse.tags || [];
  const difficulty = getDifficultyFromTags(tags);
  const language = getLanguageFromTags(tags);

  return {
    id: apiCourse.id,
    authorId: apiCourse.authorId,
    authorName: apiCourse.authorName,
    title: apiCourse.title,
    description: apiCourse.description,
    coverUrl: apiCourse.coverUrl || null,
    estimatedDuration: apiCourse.estimatedDuration || null,
    version: apiCourse.version,
    isPublished: apiCourse.isPublished,
    tags: tags,
    difficulty: difficulty,
    language: language,
    stats: {
      enrollments: apiCourse.stats?.enrollments || 0,
      avgCompletion: apiCourse.stats?.avgCompletion || 0,
      avgRating: apiCourse.stats?.avgRating || 0,
    },
    // lessons structure depends on whether it's a list view or detail view
    // For simplicity, the API might return summaries for lists and full for details.
    // This mapping function might need to be adapted or have variants if lesson structure varies.
    lessons: apiCourse.lessons || [],
    createdAt: apiCourse.createdAt,
    updatedAt: apiCourse.updatedAt,
  };
};


export async function getCourses(params?: {
  search?: string;
  sort?: string;
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
}): Promise<Course[]> {
  if (USE_MOCK_DATA) {
    console.warn("Mock data for getCourses needs an update for the new Course structure.");
    return [];
  }

  const apiParams: ApiCourseParams = {};
  if (params?.search) apiParams.search = params.search;
  if (params?.sort) apiParams.sort = params.sort as ApiCourseParams['sort'];

  const filterTags = [...(params?.tags || [])];
  if (params?.level) filterTags.push(params.level);
  if (params?.language) filterTags.push(params.language);

  if (filterTags.length > 0) {
    apiParams.tags = filterTags.join(',');
  }

  const response = await client.get<any[]>('/courses', { params: apiParams });
  return response.data.map(mapApiCourseToFrontendCourse); // Uses the exported function
}

export async function getCourseById(id: string, version?: number): Promise<Course> {
  if (USE_MOCK_DATA) {
    console.warn("Mock data for getCourseById needs an update.");
    throw new Error("Mock course not found");
  }
  const apiParams: { version?: number } = {};
  if (version) apiParams.version = version;

  const response = await client.get<any>(`/courses/${id}`, { params: apiParams });
  return mapApiCourseToFrontendCourse(response.data); // Uses the exported function
}

export async function uploadCourseCover(formData: FormData): Promise<{ coverUrl: string }> {
  try {
    const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { coverUrl: response.data.avatarUrl };
  } catch (error) {
    console.error("Error uploading course cover:", error);
    throw error;
  }
}

export async function createCourseFacade(payload: CourseFacadePayload): Promise<Course> {
   if (USE_MOCK_DATA) {
    throw new Error("Mock for createCourseFacade not implemented");
  }
  const apiPayload: CourseCreatePayload = {
      ...payload,
  };
  const response = await client.post<any>('/courses', apiPayload);
  return mapApiCourseToFrontendCourse(response.data); // Uses the exported function
}

export async function enrollCourse(courseId: string): Promise<any> {
  if (USE_MOCK_DATA) { return Promise.resolve({success: true}); }
  const response = await client.post(`/courses/${courseId}/enroll`);
  return response.data;
}

export async function rateCourse(courseId: string, value: number, comment?: string): Promise<any> {
  if (USE_MOCK_DATA) { return Promise.resolve({success: true}); }
  const response = await client.post(`/courses/${courseId}/rating`, { value, comment });
  return response.data;
}

export async function getAvailableTags(): Promise<string[]> {
  if (USE_MOCK_DATA) return ['MockTag1', 'MockTag2', 'Beginner', 'Python'];
  try {
    const response = await client.get<string[]>('/courses/tags');
    return response.data;
  } catch (error) {
    console.error('Error fetching available tags:', error);
    return ['ErrorFetching', 'FallbackTag'];
  }
}