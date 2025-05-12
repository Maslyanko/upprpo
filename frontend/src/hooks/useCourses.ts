import { useState, useEffect } from 'react';
import { getCourses } from '../api/coursesApi';
import type { Course } from '../types/Course';

interface CourseFilters {
  search?: string;
  sort?: 'popularity' | 'difficulty' | 'duration';
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<CourseFilters>({
    sort: 'popularity'
  });

  const fetchCourses = async (newFilters?: Partial<CourseFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    setLoading(true);
    try {
      const data = await getCourses(updatedFilters);
      setCourses(data);
      setError(null);
    } catch (e) {
      setError(e as Error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchCourses();
  }, []);

  return { 
    courses, 
    loading, 
    error, 
    filters,
    fetchCourses 
  };
}