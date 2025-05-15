import client from './client';
import type { Course, CourseCreatePayload } from '../types/Course'; // Добавили CourseCreatePayload
import type { CourseFilters } from '../hooks/useCourses';

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
              (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchLower)))
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
              const difficultyOrder = { 'Beginner': 1, 'Middle': 2, 'Senior': 3 } as const;
              filteredCourses = filteredCourses.sort(
                (a, b) => difficultyOrder[a.difficulty as keyof typeof difficultyOrder] - difficultyOrder[b.difficulty as keyof typeof difficultyOrder]
              );
              break;
            case 'duration':
              filteredCourses = filteredCourses.sort(
                (a, b) => (b.estimatedDuration || 0) - (a.estimatedDuration || 0)
              );
              break;
          }
        }
        
        resolve(filteredCourses);
      }, 600); // Simulate a short delay
    });
  } else {
    // Real API call
    const apiParams: Record<string, string | string[] | undefined> = {};
    
    // Map frontend params to API params
    if (params?.search) apiParams.search = params.search;
    if (params?.sort) apiParams.sort = params.sort;
    if (params?.level) apiParams.difficulty = params.level;
    if (params?.language) apiParams.language = params.language;
    if (params?.tags && params.tags.length > 0) {
      apiParams.tags = params.tags.join(',');
    }
    
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

// Функция для загрузки обложки курса (если используется отдельный эндпоинт)
// Если бэкенд принимает файл вместе с остальными данными курса, эта функция может не понадобиться.
// Предположим, что нам нужен URL обложки для CourseCreatePayload.
// Эту функцию можно вызвать перед createNewCourse, если обложка загружается отдельно.
export async function uploadCourseCover(formData: FormData): Promise<{ coverUrl: string }> {
  // Примерный URL, его нужно будет создать на бэкенде (например, /courses/upload-cover)
  // Этот эндпоинт должен сохранять файл и возвращать его URL.
  // Пока такого эндпоинта нет, это просто заглушка.
  // В реальности, бэкэнд `Course.create` ожидает `coverUrl` в `courseData`.
  // Возможно, будет проще, если `User.uploadAvatar` будет более общим `uploadImage`
  // или если будет специальный эндпоинт для загрузки обложек курсов.
  // Пока сделаем заглушку, предполагая, что URL будет получен как-то.
  console.warn("uploadCourseCover is a placeholder. Implement actual image upload to get coverUrl.");
  // const response = await client.post<{ coverUrl: string }>('/files/upload-image', formData, { // Примерный URL
  //   headers: { 'Content-Type': 'multipart/form-data' }
  // });
  // return response.data;
  return new Promise(resolve => setTimeout(() => resolve({ coverUrl: `/uploads/course_covers_placeholder/${Date.now()}.png`}), 500));
}


// Обновленная функция для создания курса
export async function createNewCourse(payload: CourseCreatePayload): Promise<Course> {
  if (USE_MOCK_DATA) {
    const { mockCourses } = await import('./mockData');
    const newMockCourse: Course = {
      id: `mock-${Date.now()}`,
      authorName: 'Текущий Пользователь', // Заменить на данные из useAuth
      title: payload.title,
      description: payload.description,
      difficulty: payload.difficulty,
      language: payload.language,
      tags: payload.tags,
      coverUrl: payload.coverUrl || '/images/courses/default-cover.png',
      estimatedDuration: 20, // Пример
      stats: { enrollments: 0, avgCompletion: 0, avgScore: 0 },
      lessons: [],
      isPublished: false,
      version: 1,
    };
    mockCourses.push(newMockCourse);
    return new Promise(resolve => setTimeout(() => resolve(newMockCourse), 500));
  } else {
    // Убедимся, что все обязательные для бэкенда поля переданы
    const apiPayload = {
        title: payload.title,
        description: payload.description,
        difficulty: payload.difficulty,
        language: payload.language,
        tags: payload.tags, // Должен быть массив строк
        coverUrl: payload.coverUrl, // URL обложки
        // estimatedDuration: payload.estimatedDuration, // Можно добавить позже
        // lessons: [], // На первом этапе не передаем
    };
    const response = await client.post<Course>('/courses', apiPayload);
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

export async function getAvailableTags(): Promise<string[]> {
  try {
    const response = await client.get<string[]>('/courses/tags');
    return response.data;
  } catch (error) {
    console.error('Error fetching available tags:', error);
    throw error;
  }
}