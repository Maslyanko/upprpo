export interface LessonSummary {
  id: string;
  title: string;
  type: 'Theory' | 'Coding';
  hasQuiz: boolean;
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgScore: number;
}

export interface Course {
  id: string;
  authorId?: string;
  authorName: string;
  coverUrl: string | null;
  title: string;
  description?: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  language?: string | null;
  tags: string[];
  estimatedDuration: number | null;
  version?: number;
  isPublished?: boolean;
  stats: CourseStats;
  lessons: LessonSummary[];
}

export interface CourseBase {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
  coverUrl?: string;
  estimatedDuration?: number;
}

// Данные для формы создания "фасада" курса
export interface CourseFacadeData {
  title: string;
  description: string;
  selectedTags: string[];
  coverFile?: File | null;
}

// Данные, отправляемые на API для создания курса
export interface CourseCreatePayload {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior'; // Обязательное поле для бэкенда
  language?: string | null; // Сделаем опциональным для API, если пользователь не выбрал
  tags: string[]; // Остальные теги
  coverUrl?: string | null;
}


export interface CourseCreateRequest extends CourseBase {
  lessons?: LessonContent[];
}

export interface CourseUpdateRequest extends CourseBase {
  lessons?: LessonContent[];
}

export interface LessonContent extends LessonSummary {
  content: string;
  videoUrl?: string;
  quiz?: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: 'choice' | 'shortText' | 'longText';
  options?: { id: string; label: string }[];
}