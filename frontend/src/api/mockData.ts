import { Course } from '../types/Course';

export const mockCourses: Course[] = [
  {
    id: '1',
    authorName: 'Иван Иванов',
    coverUrl: '/images/courses/python.png',
    title: 'Подготовка к Python Middle собеседованию',
    difficulty: 'Middle',
    language: 'Python',
    tags: ['Python', 'Backend', 'Algorithms'],
    estimatedDuration: 20,
    stats: {
      enrollments: 156,
      avgCompletion: 73,
      avgScore: 4.9
    },
    lessons: [
      { id: '101', title: 'Основы Python', type: 'Theory', hasQuiz: true },
      { id: '102', title: 'Структуры данных', type: 'Theory', hasQuiz: true },
      { id: '103', title: 'Алгоритмы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    id: '2',
    authorName: 'Полина Смирнова',
    coverUrl: '/images/courses/algos.png',
    title: 'Алгоритмы и структуры данных для собеседований',
    difficulty: 'Middle',
    language: 'JavaScript',
    tags: ['Algorithms', 'Data Structures', 'Leetcode'],
    estimatedDuration: 15,
    stats: {
      enrollments: 243,
      avgCompletion: 68,
      avgScore: 4.8
    },
    lessons: [
      { id: '201', title: 'Сложность алгоритмов', type: 'Theory', hasQuiz: true },
      { id: '202', title: 'Сортировки', type: 'Coding', hasQuiz: true },
      { id: '203', title: 'Деревья и графы', type: 'Theory', hasQuiz: true }
    ]
  },
  {
    id: '3',
    authorName: 'Петр Петров',
    coverUrl: '/images/courses/anal.png',
    title: 'Интервью аналитика: SQL, Excel, кейсы',
    difficulty: 'Beginner',
    language: 'SQL',
    tags: ['SQL', 'Analytics', 'Excel'],
    estimatedDuration: 12,
    stats: {
      enrollments: 189,
      avgCompletion: 82,
      avgScore: 4.8
    },
    lessons: [
      { id: '301', title: 'Основы SQL', type: 'Theory', hasQuiz: true },
      { id: '302', title: 'Сложные запросы', type: 'Coding', hasQuiz: true },
      { id: '303', title: 'Аналитические кейсы', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    id: '4',
    authorName: 'Василий Васильев',
    coverUrl: '/images/courses/softs.png',
    title: 'Расскажи о себе: soft skills на собеседовании',
    difficulty: 'Beginner',
    language: 'Русский',
    tags: ['Soft skills', 'HR', 'Interview'],
    estimatedDuration: 8,
    stats: {
      enrollments: 315,
      avgCompletion: 91,
      avgScore: 5.0
    },
    lessons: [
      { id: '401', title: 'Самопрезентация', type: 'Theory', hasQuiz: true },
      { id: '402', title: 'Сложные вопросы', type: 'Theory', hasQuiz: true },
      { id: '403', title: 'Обратная связь', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    id: '5',
    authorName: 'Александра Александрова',
    coverUrl: '/images/courses/sysdis.png',
    title: 'System Design для Senior',
    difficulty: 'Senior',
    language: 'English',
    tags: ['System Design', 'Architecture', 'Senior'],
    estimatedDuration: 25,
    stats: {
      enrollments: 142,
      avgCompletion: 62,
      avgScore: 4.7
    },
    lessons: [
      { id: '501', title: 'Основы системного дизайна', type: 'Theory', hasQuiz: true },
      { id: '502', title: 'Масштабирование', type: 'Theory', hasQuiz: true },
      { id: '503', title: 'Практические кейсы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    id: '6',
    authorName: 'Андрей Андреев',
    coverUrl: '/images/courses/js.png',
    title: 'JavaScript для Junior Frontend',
    difficulty: 'Beginner',
    language: 'JavaScript',
    tags: ['JavaScript', 'Frontend', 'Web'],
    estimatedDuration: 18,
    stats: {
      enrollments: 278,
      avgCompletion: 76,
      avgScore: 5.0
    },
    lessons: [
      { id: '601', title: 'Основы JavaScript', type: 'Theory', hasQuiz: true },
      { id: '602', title: 'DOM манипуляции', type: 'Theory', hasQuiz: true },
      { id: '603', title: 'Асинхронный JavaScript', type: 'Coding', hasQuiz: true }
    ]
  }
];

// Add this to src/api/mockData.ts

export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  fullName: "Тестовый Пользователь",
  avatarUrl: null,
  stats: {
    activeCourses: 2,
    completedCourses: 1,
    avgScore: 85.5
  }
};

// Modify the coursesApi.ts file to use mock data
// You'll replace this with actual API calls later

export function setupMockApi() {
  // You can intercept axios here if needed
  console.log('Mock API setup complete');
}