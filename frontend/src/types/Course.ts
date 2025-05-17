// ==== File: frontend/src/types/Course.ts ====
// (Только измененная часть)
import { v4 as uuidv4 } from 'uuid';

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
  text: string; // Markdown
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT';
  correct_answer?: string | null; 
  sort_order: number;
  options: QuestionOption[];
  userAnswer?: UserAnswerSubmission; 
  isCorrect?: boolean | null; // null = not answered/checked, true/false after check
  feedback?: string; 
  isAttemptAllowed?: boolean; // NEW: true by default, false after correct answer or if logic dictates no more tries.
}

export interface LessonPage {
  id: string;
  lesson_id?: string;
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  content: string;
  questions: Question[];
}

export interface LessonIdentifiable {
  id: string;
  title: string;
  sort_order: number;
}

export interface LessonEditable extends LessonIdentifiable {
    description?: string | null;
    pages: LessonPage[];
    completedByUser?: boolean; 
}

export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  hasQuiz: boolean; 
  completedByUser?: boolean;
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
  lessons: (LessonEditable[] | LessonSummary[]);
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

export interface QuestionOptionPayload {
  id?: string; 
  label: string;
  is_correct: boolean;
  sort_order: number;
}
export interface QuestionPayload {
  id?: string; 
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT';
  correct_answer?: string | null;
  sort_order: number;
  options: QuestionOptionPayload[];
}
export interface LessonPagePayload {
  id?: string; 
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  content: string; 
  questions: QuestionPayload[]; 
}
export interface LessonPayloadForBackend {
    id?: string; 
    title: string;
    description?: string | null;
    sort_order: number;
    pages: LessonPagePayload[];
}
export interface CourseContentUpdatePayload {
  lessons: LessonPayloadForBackend[];
  title?: string;
  description?: string;
  tags?: string[];
  coverUrl?: string | null;
  estimatedDuration?: number;
}

export interface AnswerPayload {
    questionId: string;
    selectedOptionIds?: string[]; 
    answerText?: string;         
}

export interface AnswerSubmissionResponse {
    message: string;
    data: {
        id: string; 
        user_id: string;
        question_id: string;
        selected_option_ids: string[] | null;
        answer_text: string | null;
        is_correct: boolean;
        submitted_at: string;
        updated_at: string;
        lessonId: string;
        lessonScore: number;
    };
}

export interface UserAnswerSubmission {
    selectedOptionIds?: string[];
    answerText?: string;
}

export const getDifficultyFromTags = (tags: string[]): 'Beginner' | 'Middle' | 'Senior' | null => {
  if (!Array.isArray(tags)) return null;
  if (tags.includes('Beginner')) return 'Beginner';
  if (tags.includes('Middle')) return 'Middle';
  if (tags.includes('Senior')) return 'Senior';
  return null;
};

const KNOWN_LANGUAGES = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'];
export const getLanguageFromTags = (tags: string[]): string | null => {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (KNOWN_LANGUAGES.includes(tag)) {
      return tag;
    }
  }
  return null;
};

export const createNewLessonPage = (type: 'METHODICAL' | 'ASSIGNMENT', sortOrder: number): LessonPage => {
    return {
        id: `temp-${uuidv4()}`, 
        title: type === 'METHODICAL' ? 'Новая страница (текст)' : 'Новое задание (тест)',
        page_type: type,
        sort_order: sortOrder,
        content: '', 
        questions: [], 
    };
};

export const createNewQuestion = (sortOrder: number): Question => {
    return {
        id: `temp-${uuidv4()}`,
        text: 'Новый вопрос...',
        type: 'TEXT_INPUT', 
        correct_answer: '', 
        sort_order: sortOrder,
        options: [], 
        isAttemptAllowed: true, // New questions allow attempts
    };
};

export const createNewQuestionOption = (sortOrder: number): QuestionOption => {
    return {
        id: `temp-${uuidv4()}`,
        label: 'Новый вариант',
        is_correct: false,
        sort_order: sortOrder,
    };
};