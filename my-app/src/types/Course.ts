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
  authorName: string;
  coverUrl: string;
  title: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags: string[];
  estimatedDuration: number; // в часах
  stats: CourseStats;
  lessons: LessonSummary[];
}