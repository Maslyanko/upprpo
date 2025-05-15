// ==== File: frontend/src/api/coursesApi.ts ====
import client from './client';
import type {
  Course,
  CourseFacadePayload,
  CourseContentUpdatePayload,
  LessonEditable
} from '../types/Course';
import { getDifficultyFromTags, getLanguageFromTags } from '../types/Course';

const USE_MOCK_DATA = false;

interface ApiCourseParams {
  search?: string;
  sort?: string;
  difficulty?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string;
}

export const mapApiCourseToFrontendCourse = (apiCourse: any): Course => {
  if (!apiCourse || typeof apiCourse !== 'object') return {} as Course;
  const tags = Array.isArray(apiCourse.tags) ? apiCourse.tags : [];
  const difficulty = getDifficultyFromTags(tags);
  const language = getLanguageFromTags(tags);

  const lessons = (Array.isArray(apiCourse.lessons) ? apiCourse.lessons : []).map((lesson: any) => ({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    sort_order: lesson.sort_order !== undefined ? lesson.sort_order : lesson.sortOrder,
    sortOrder: lesson.sortOrder !== undefined ? lesson.sortOrder : lesson.sort_order,
    hasQuiz: !!lesson.hasQuiz || (lesson.pages && lesson.pages.some((p:any) => p.page_type === 'ASSIGNMENT' && p.questions?.length > 0)),
    pages: Array.isArray(lesson.pages) ? lesson.pages.map((page: any) => ({
        ...page,
        questions: Array.isArray(page.questions) ? page.questions.map((q: any) => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : []
        })) : []
    })) : [],
  }));

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
    lessons: lessons,
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
  if (USE_MOCK_DATA) { return []; }
  const apiParams: ApiCourseParams = {};
  if (params?.search) apiParams.search = params.search;
  if (params?.sort) apiParams.sort = params.sort;
  const filterTags = [...(params?.tags || [])];
  if (params?.level) filterTags.push(params.level);
  if (params?.language) filterTags.push(params.language);
  if (filterTags.length > 0) { apiParams.tags = filterTags.join(','); }
  const response = await client.get<any[]>('/courses', { params: apiParams });
  return response.data.map(mapApiCourseToFrontendCourse);
}

export async function getCourseById(id: string, version?: number): Promise<Course> {
  if (USE_MOCK_DATA) { return mapApiCourseToFrontendCourse({ id, title: "Mock Course by ID", lessons: [{id: "l1", title: "Mock Lesson 1", sort_order:0, pages:[]}], tags:[], stats:{enrollments:0, avgCompletion:0, avgRating:0}}); }
  const apiParams: { version?: number } = {};
  if (version) apiParams.version = version;
  const response = await client.get<any>(`/courses/${id}`, { params: apiParams });
  return mapApiCourseToFrontendCourse(response.data);
}

export async function uploadCourseCover(formData: FormData): Promise<{ coverUrl: string }> {
  const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return { coverUrl: response.data.avatarUrl };
}

export async function createCourseFacade(payload: CourseFacadePayload): Promise<Course> {
  const response = await client.post<any>('/courses', payload);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function updateCourseFacade(courseId: string, payload: CourseFacadePayload): Promise<Course> {
  const response = await client.put<any>(`/courses/${courseId}`, payload);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function enrollCourse(courseId: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/enroll`);
  return response.data;
}

export async function rateCourse(courseId: string, value: number, comment?: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/rating`, { value, comment });
  return response.data;
}

export async function getAvailableTags(): Promise<string[]> {
  if (USE_MOCK_DATA) return ['MockTag1', 'Beginner', 'Python'];
  const response = await client.get<string[]>('/courses/tags');
  return response.data;
}

export async function updateCourseContent(courseId: string, payload: CourseContentUpdatePayload): Promise<Course> {
  if (USE_MOCK_DATA) { return mapApiCourseToFrontendCourse({ id: courseId, title: "Mock Updated Course Title", lessons: payload.lessons || [], tags:[], stats:{enrollments:0, avgCompletion:0, avgRating:0}}); }
  const response = await client.put<any>(`/courses/${courseId}`, payload);
  return mapApiCourseToFrontendCourse(response.data);
}