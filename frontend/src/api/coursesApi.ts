// ==== File: frontend/src/api/coursesApi.ts ====
// (Только измененная/добавленная часть mapApiCourseToFrontendCourse и зависимости)
import client from './client';
import type {
  Course,
  CourseFacadePayload,
  CourseContentUpdatePayload,
  LessonSummary, 
  LessonEditable,
  Question as FrontendQuestionType, // Дадим псевдоним, чтобы избежать конфликта с переменной question
  AnswerPayload, 
  AnswerSubmissionResponse 
} from '../types/Course';
import { getDifficultyFromTags, getLanguageFromTags } from '../types/Course';


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
                questions: Array.isArray(page.questions) ? page.questions.map((qFromApi: any): FrontendQuestionType => {
                    // qFromApi.userAnswer теперь должен быть объектом { selectedOptionIds, answerText } или undefined
                    // qFromApi.isCorrect должен быть boolean или null
                    // qFromApi.userAnswerId должен быть string или undefined

                    const isAttemptAllowedBasedOnCorrectness = qFromApi.isCorrect === true ? false : true;

                    return {
                        id: qFromApi.id,
                        text: qFromApi.text,
                        type: qFromApi.type,
                        correct_answer: qFromApi.correct_answer, 
                        sort_order: qFromApi.sort_order !== undefined ? qFromApi.sort_order : qFromApi.sortOrder,
                        options: Array.isArray(qFromApi.options) ? qFromApi.options.map(opt => ({
                            ...opt,
                            sort_order: opt.sort_order !== undefined ? opt.sort_order : opt.sortOrder,
                        })) : [],
                        userAnswer: qFromApi.userAnswer, // Это уже должно быть в нужном формате {selectedOptionIds?, answerText?}
                        userAnswerId: qFromApi.userAnswerId,
                        isCorrect: qFromApi.isCorrect !== undefined ? qFromApi.isCorrect : null,
                        // isAttemptAllowed будет управляться в CourseTakingPage на основе isCorrect и логики повторов
                        // Здесь можно установить начальное значение, если бэк не передает его явно:
                        isAttemptAllowed: qFromApi.isAttemptAllowed !== undefined ? qFromApi.isAttemptAllowed : isAttemptAllowedBasedOnCorrectness,
                        feedback: undefined // feedback устанавливается на клиенте после попытки
                    };
                }) : []
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

// ... (остальные функции getCourses, getCourseById и т.д. без изменений)
// Полный код для coursesApi.ts, чтобы было все в одном месте
export async function getCourses(params?: {
  search?: string;
  sort?: string;
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
}): Promise<Course[]> {
  const apiParams: any = {}; 
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

export async function submitAnswerApi(payload: AnswerPayload): Promise<AnswerSubmissionResponse> {
    const response = await client.post<AnswerSubmissionResponse>(
        `/courses/answers/questions/${payload.questionId}/submit`,
        { selectedOptionIds: payload.selectedOptionIds, answerText: payload.answerText }
    );
    return response.data;
}