import { useState, useEffect, useCallback } from 'react';
import { getCourses } from '../api/coursesApi';
import type { Course } from '../types/Course';

export interface CourseFilters {
  search?: string;
  sort?: 'popularity' | 'difficulty' | 'duration';
  level?: 'Beginner' | 'Middle' | 'Senior'; // Keep these if you plan to re-add dropdowns
  language?: string; // Keep these
  tags?: string[];
}

// Default filters, also used for resetting
export const defaultCourseFilters: CourseFilters = {
  sort: 'popularity',
  tags: [],
  search: '',
  level: undefined,
  language: undefined,
};


export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeFilters, setActiveFilters] = useState<CourseFilters>(defaultCourseFilters);

  const fetchCourses = useCallback(async (filtersToFetch: CourseFilters) => {
    console.log("Fetching courses with filters:", filtersToFetch);
    setLoading(true);
    setError(null);
    try {
      const data = await getCourses(filtersToFetch);
      setCourses(data);
    } catch (e) {
      setError(e as Error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("useEffect in useCourses triggered. Active filters:", activeFilters);
    fetchCourses(activeFilters);
  }, [activeFilters, fetchCourses]);

  const applyFilters = useCallback((newFilterSettings: Partial<CourseFilters> | CourseFilters) => {
    // If newFilterSettings is a complete CourseFilters object (like for reset), use it directly.
    // Otherwise, merge with previous.
    if (
        'search' in newFilterSettings &&
        'sort' in newFilterSettings &&
        'tags' in newFilterSettings &&
        'level' in newFilterSettings &&
        'language' in newFilterSettings
    ) { // Heuristic to check if it's a full reset object
         setActiveFilters(newFilterSettings as CourseFilters);
    } else {
        setActiveFilters(prevFilters => {
            const updated = { ...prevFilters, ...(newFilterSettings as Partial<CourseFilters>) };
            // Ensure tags are correctly handled during partial updates
            if (newFilterSettings.tags === undefined && prevFilters.tags) {
                updated.tags = prevFilters.tags;
            } else if (Array.isArray(newFilterSettings.tags)) {
                updated.tags = newFilterSettings.tags;
            } else { // Default to empty array if tags are not specified or invalid
                updated.tags = prevFilters.tags || [];
            }
            return updated;
        });
    }
  }, []);

  return {
    courses,
    loading,
    error,
    filters: activeFilters,
    applyFilters,
  };
}