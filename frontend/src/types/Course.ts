export interface LessonSummary {
  id: string;
  title: string;
  type: 'Theory' | 'Coding'; // Ensure backend uses these exact strings
  hasQuiz: boolean;
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgScore: number;
}

export interface Course {
  id: string;
  authorId?: string; // Included in backend model
  authorName: string; // Included in backend model (joined from users)
  coverUrl: string | null; // Make nullable if backend allows it
  title: string;
  description?: string; // Included in backend model
  difficulty: 'Beginner' | 'Middle' | 'Senior'; // Ensure backend uses these exact strings
  language?: string | null; // Make nullable
  tags: string[]; // Included in backend model
  estimatedDuration: number | null; // Make nullable
  version?: number; // Included in backend model
  isPublished?: boolean; // Included in backend model
  stats: CourseStats; // Included in backend model
  lessons: LessonSummary[]; // Included in backend model
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