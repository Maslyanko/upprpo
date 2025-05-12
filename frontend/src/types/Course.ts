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
  authorId?: string; // Добавлено согласно API
  authorName: string;
  coverUrl: string;
  title: string;
  description?: string; // Добавлено согласно API
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags: string[];
  estimatedDuration: number; // в часах
  version?: number; // Добавлено согласно API
  isPublished?: boolean; // Добавлено согласно API
  stats: CourseStats;
  lessons: LessonSummary[];
}

// Модели для создания и обновления курсов
export interface CourseBase {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  tags?: string[];
  language?: string;
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