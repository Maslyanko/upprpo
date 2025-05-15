// ==== File: frontend/src/types/Course.ts ====

// For METHODICAL pages
export interface MethodicalPageContent {
  content: string; // Markdown content
}

// For ASSIGNMENT pages
export interface QuestionOption {
  id: string;
  label: string;
  is_correct: boolean;
  sort_order: number;
}

export interface Question {
  id: string;
  text: string; // Description of the task/question
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT'; // Add more as needed
  sort_order: number;
  options?: QuestionOption[];
}

export interface LessonPage {
  id: string;
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  // Content is specific to page type
  content?: string; // For METHODICAL pages (Markdown)
  questions?: Question[]; // For ASSIGNMENT pages
}

export interface Lesson { // Detailed lesson structure
  id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  pages: LessonPage[];
  // hasQuiz might be determined by checking if pages include ASSIGNMENT type with questions
}

export interface LessonSummary { // For course list / overview
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number; // Renamed from sort_order for consistency
  hasQuiz: boolean; // Indicates if the lesson contains any quiz/assignment pages
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgRating: number; // Changed from avgScore
}

export interface Course {
  id: string;
  authorId?: string; // Still optional as it might not always be needed by frontend
  authorName: string;
  title: string;
  description?: string;
  coverUrl: string | null;
  estimatedDuration: number | null;
  version?: number;
  isPublished?: boolean;
  tags: string[]; // Array of tag names, e.g., ["Python", "Beginner", "Backend"]
  difficulty: 'Beginner' | 'Middle' | 'Senior' | null; // Derived from tags
  language: string | null; // Derived from tags, if specific language tags are used
  stats: CourseStats;
  lessons: Lesson[] | LessonSummary[]; // Detailed for single course, summary for list
  createdAt?: string; // Optional, might not always be present or needed
  updatedAt?: string; // Optional
}

// Data for the initial "facade" creation form
export interface CourseFacadePayload {
  title: string;
  description: string;
  tags: string[]; // All selected tag names, backend will sort out difficulty/language
  coverUrl?: string | null;
  estimatedDuration?: number; // Optional at facade creation
}

// Full payload for backend Course.create, potentially including lessons
export interface CourseCreatePayload extends CourseFacadePayload {
    lessonsData?: Array<{ // This structure mirrors backend Course.create expectation
        title: string;
        description?: string | null;
        pages: Array<{
            title: string;
            pageType: 'METHODICAL' | 'ASSIGNMENT';
            content?: string; // For METHODICAL
            questions?: Array<{ // For ASSIGNMENT
                text: string;
                type: string;
                options?: Array<{ label: string; isCorrect?: boolean }>;
            }>;
        }>;
    }>;
}

// Helper function to extract difficulty from tags
export const getDifficultyFromTags = (tags: string[]): 'Beginner' | 'Middle' | 'Senior' | null => {
  if (tags.includes('Beginner')) return 'Beginner';
  if (tags.includes('Middle')) return 'Middle';
  if (tags.includes('Senior')) return 'Senior';
  return null;
};

// Helper function to extract language from tags (example, customize as needed)
// This assumes language tags are unique and identifiable (e.g., not "JavaScript Basics" but just "JavaScript")
const KNOWN_LANGUAGES = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский']; // Extend this list
export const getLanguageFromTags = (tags: string[]): string | null => {
  for (const tag of tags) {
    if (KNOWN_LANGUAGES.includes(tag)) {
      return tag;
    }
  }
  return null;
};