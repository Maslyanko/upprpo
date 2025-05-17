// ==== File: frontend/src/api/coursesApi.ts ====
import client from './client';
import type {
  Course,
  CourseFacadePayload,
  CourseContentUpdatePayload,
  LessonSummary, 
  LessonEditable,
  AnswerPayload, // NEW
  AnswerSubmissionResponse // NEW
} from '../types/Course';
import { getDifficultyFromTags, getLanguageFromTags } from '../types/Course';

interface ApiCourseParams {
  search?: string;
  sort?: string;
  difficulty?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string; // Comma-separated string
}

// Helper to decide if lessons are summaries or editable based on structure
function areLessonsEditable(lessons: any[]): lessons is LessonEditable[] {
  if (lessons.length === 0) return false; // Or true, depending on desired default
  return lessons.some(lesson => lesson.pages !== undefined); // Editable lessons have a 'pages' array
}

export const mapApiCourseToFrontendCourse = (apiCourse: any): Course => {
  if (!apiCourse || typeof apiCourse !== 'object') {
    console.warn("mapApiCourseToFrontendCourse received invalid data:", apiCourse);
    return {} as Course; 
  }
  const tags = Array.isArray(apiCourse.tags) ? apiCourse.tags : [];
  const difficulty = getDifficultyFromTags(tags);
  const language = getLanguageFromTags(tags);

  const lessons = (Array.isArray(apiCourse.lessons) ? apiCourse.lessons : []).map((lesson: any) => {
    const baseLesson = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      sort_order: lesson.sort_order !== undefined ? lesson.sort_order : lesson.sortOrder, 
      hasQuiz: !!lesson.hasQuiz || (lesson.pages && lesson.pages.some((p:any) => p.page_type === 'ASSIGNMENT' && p.questions?.length > 0)),
      completedByUser: lesson.completedByUser || false, 
    };
    if (lesson.pages) { 
        return {
            ...baseLesson,
            pages: Array.isArray(lesson.pages) ? lesson.pages.map((page: any) => ({
                id: page.id,
                title: page.title,
                page_type: page.page_type,
                sort_order: page.sort_order !== undefined ? page.sort_order : page.sortOrder,
                content: page.content || '',
                questions: Array.isArray(page.questions) ? page.questions.map((q: any) => ({
                    id: q.id,
                    text: q.text,
                    type: q.type,
                    correct_answer: q.correct_answer, 
                    sort_order: q.sort_order !== undefined ? q.sort_order : q.sortOrder,
                    options: Array.isArray(q.options) ? q.options.map(opt => ({
                        ...opt,
                        sort_order: opt.sort_order !== undefined ? opt.sort_order : opt.sortOrder,
                    })) : [],
                    userAnswer: undefined, // Initialize client-side state for answers
                    isCorrect: null,       // Initialize client-side state for answers
                    feedback: undefined    // Initialize client-side state for answers
                })) : []
            })) : [],
        } as LessonEditable;
    }
    return baseLesson as LessonSummary; 
  });


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
  const apiParams: ApiCourseParams = {};
  if (params?.search) apiParams.search = params.search;
  if (params?.sort) apiParams.sort = params.sort;
  
  const allFilterTags = [...(params?.tags || [])];
  if (params?.level) allFilterTags.push(params.level);
  if (params?.language && !allFilterTags.includes(params.language)) {
     allFilterTags.push(params.language);
  }
  
  if (allFilterTags.length > 0) {
    apiParams.tags = allFilterTags.join(',');
  }

  const response = await client.get<any[]>('/courses', { params: apiParams });
  return response.data.map(mapApiCourseToFrontendCourse);
}

export async function getCourseById(id: string, version?: number): Promise<Course> {
  const apiParams: { version?: number } = {};
  if (version) apiParams.version = version;
  const response = await client.get<any>(`/courses/${id}`, { params: apiParams });
  return mapApiCourseToFrontendCourse(response.data);
}

export async function uploadCourseCover(formData: FormData): Promise<{ coverUrl: string }> {
  const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  });
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

export async function enrollCourseApi(courseId: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/enroll`);
  return response.data;
}

export async function rateCourseApi(courseId: string, value: number, comment?: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/rating`, { value, comment });
  return response.data;
}

export async function getAvailableTags(): Promise<string[]> {
  const response = await client.get<string[]>('/courses/tags');
  return response.data;
}

export async function updateCourseContent(courseId: string, payload: CourseContentUpdatePayload): Promise<Course> {
  const response = await client.put<any>(`/courses/${courseId}`, payload); 
  return mapApiCourseToFrontendCourse(response.data);
}

export async function publishCourseApi(courseId: string): Promise<Course> {
  const response = await client.post<any>(`/courses/${courseId}/publish`);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function deleteCourseApi(courseId: string): Promise<void> {
  await client.delete(`/courses/${courseId}`);
}

interface MarkLessonCompleteResponse {
    message: string;
    courseId: string;
    lessonId: string;
    userProgress: number;
    userStatus: 'inProgress' | 'completed';
}
export async function markLessonCompleteApi(lessonId: string): Promise<MarkLessonCompleteResponse> {
    const response = await client.post<MarkLessonCompleteResponse>(`/courses/lessons/${lessonId}/complete`);
    return response.data;
}

// New function to submit an answer
export async function submitAnswerApi(payload: AnswerPayload): Promise<AnswerSubmissionResponse> {
    const response = await client.post<AnswerSubmissionResponse>(
        `/courses/answers/questions/${payload.questionId}/submit`, // Note: /courses prefix for route
        { selectedOptionIds: payload.selectedOptionIds, answerText: payload.answerText }
    );
    return response.data;
}