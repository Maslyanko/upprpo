export interface UserStats {
  activeCourses: number;
  completedCourses: number;
  avgScore: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  stats: UserStats;
}