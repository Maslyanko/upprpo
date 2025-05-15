// ==== File: frontend/src/hooks/useCourses.ts ====
import { useState, useEffect, useCallback } from 'react';
import { getCourses as apiGetCourses } from '../api/coursesApi'; // Renamed to avoid conflict
import type { Course } from '../types/Course';

export interface CourseFilters {
  search?: string;
  sort?: string; // e.g., 'popularity', 'created_at_desc' (matches backend if possible)
  level?: 'Beginner' | 'Middle' | 'Senior'; // This is a specific tag
  language?: string; // This is a specific tag
  tags?: string[]; // Other general tags
}

export const defaultCourseFilters: CourseFilters = {
  sort: 'popularity', // A default sort criteria
  tags: [],
  search: '',
  level: undefined,
  language: undefined,
};

export function useCourses(initialFilters: CourseFilters = defaultCourseFilters) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeFilters, setActiveFilters] = useState<CourseFilters>(initialFilters);

  const fetchCourses = useCallback(async (filtersToUse: CourseFilters) => {
    setLoading(true);
    setError(null);
    try {
      // The apiGetCourses function in coursesApi.ts now handles mapping
      // difficulty/language from filtersToUse.level/language into its 'tags' param for the API
      const data = await apiGetCourses(filtersToUse);
      setCourses(data);
    } catch (e) {
      setError(e as Error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses(activeFilters);
  }, [activeFilters, fetchCourses]);

  const applyFilters = useCallback((newFilterSettings: Partial<CourseFilters> | CourseFilters) => {
    setActiveFilters(prevFilters => {
      // Check if it's a full reset or a partial update
      const isFullReset = 'search' in newFilterSettings && 'sort' in newFilterSettings &&
                          'tags' in newFilterSettings && 'level' in newFilterSettings &&
                          'language' in newFilterSettings;
      if (isFullReset) {
        return newFilterSettings as CourseFilters;
      }
      return { ...prevFilters, ...(newFilterSettings as Partial<CourseFilters>) };
    });
  }, []);

  return {
    courses,
    loading,
    error,
    filters: activeFilters,
    applyFilters,
  };
}