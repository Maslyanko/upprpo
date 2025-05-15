// ==== File: frontend/src/types/User.ts ====
export interface UserStats {
  activeCourses: number;
  completedCourses: number;
  avgScore: number; // Backend currently sends 0, this might need client-side interpretation or backend update
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  stats: UserStats;
  createdAt?: string; // Optional, as per backend User model
  updatedAt?: string; // Optional
}