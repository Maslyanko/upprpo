// ==== File: frontend/src/types/Course.ts ====

export interface MethodicalPageContent {
  content: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  is_correct: boolean;
  sort_order: number;
}

export interface Question {
  id: string;
  page_id?: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT';
  sort_order: number;
  options?: QuestionOption[];
}

export interface LessonPage {
  id: string;
  lesson_id?: string;
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  content?: string;
  questions?: Question[];
}

export interface LessonEditable extends LessonIdentifiable {
    description?: string | null;
    pages?: LessonPage[];
}

export interface LessonIdentifiable {
  id: string;
  title: string;
  sort_order: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  hasQuiz: boolean;
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgRating: number;
}

export interface Course {
  id: string;
  authorId?: string;
  authorName: string;
  title: string;
  description?: string;
  coverUrl: string | null;
  estimatedDuration: number | null;
  version?: number;
  isPublished?: boolean;
  tags: string[];
  difficulty: 'Beginner' | 'Middle' | 'Senior' | null;
  language: string | null;
  stats: CourseStats;
  lessons: LessonSummary[] | LessonEditable[] | Lesson[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseFacadePayload {
  title: string;
  description: string;
  tags: string[];
  coverUrl?: string | null;
  estimatedDuration?: number;
}

export interface LessonPayloadForBackend {
    id?: string;
    title: string;
    description?: string | null;
    sort_order: number; // Бэкенд может использовать индекс массива
    pages?: Array<{
        id?: string;
        title: string;
        page_type: 'METHODICAL' | 'ASSIGNMENT';
        sort_order: number;
        content?: string;
        questions?: Array<{
            id?: string;
            text: string;
            type: string;
            sort_order: number;
            options?: Array<{ id?: string; label: string; is_correct?: boolean; sort_order: number }>;
        }>;
    }>;
}
export interface CourseContentUpdatePayload {
  lessons?: LessonPayloadForBackend[];
  // Могут быть и другие поля для обновления всего курса, если бэк это поддерживает одним запросом
  // title?: string;
  // description?: string;
}

export const getDifficultyFromTags = (tags: string[]): 'Beginner' | 'Middle' | 'Senior' | null => {
  if (!tags) return null;
  if (tags.includes('Beginner')) return 'Beginner';
  if (tags.includes('Middle')) return 'Middle';
  if (tags.includes('Senior')) return 'Senior';
  return null;
};

const KNOWN_LANGUAGES = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'];
export const getLanguageFromTags = (tags: string[]): string | null => {
  if (!tags) return null;
  for (const tag of tags) {
    if (KNOWN_LANGUAGES.includes(tag)) {
      return tag;
    }
  }
  return null;
};