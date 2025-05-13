const { v4: uuidv4 } = require('uuid');

// Пользователи
const users = [
  {
    id: uuidv4(),
    email: 'ivan@example.com',
    password: '$2a$10$CwTycUXWue0Thq9StjUM0uQxTmLsYYo1xRySdvFXMccg5tpUALpre', // password: 'password'
    fullName: 'Иван Иванов',
    avatarUrl: null,
    stats: {
      activeCourses: 2,
      completedCourses: 5,
      avgScore: 78.4
    }
  },
  {
    id: uuidv4(),
    email: 'polina@example.com',
    password: '$2a$10$CwTycUXWue0Thq9StjUM0uQxTmLsYYo1xRySdvFXMccg5tpUALpre', // password: 'password'
    fullName: 'Полина Смирнова',
    avatarUrl: null,
    stats: {
      activeCourses: 1,
      completedCourses: 3,
      avgScore: 82.0
    }
  },
  {
    id: uuidv4(),
    email: 'user@example.com',
    password: '$2a$10$CwTycUXWue0Thq9StjUM0uQxTmLsYYo1xRySdvFXMccg5tpUALpre', // password: 'password'
    fullName: 'Тестовый Пользователь',
    avatarUrl: null,
    stats: {
      activeCourses: 3,
      completedCourses: 1,
      avgScore: 85.5
    }
  }
];

// Курсы
const courses = [
  {
    id: '1',
    authorId: users[0].id,
    authorName: users[0].fullName,
    coverUrl: '/images/courses/python.png',
    title: 'Подготовка к Python Middle собеседованию',
    description: 'Полноценный курс для подготовки к Python Middle собеседованиям.',
    difficulty: 'Middle',
    language: 'Python',
    tags: ['Python', 'Backend', 'Algorithms'],
    estimatedDuration: 20,
    version: 1,
    isPublished: true,
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
    authorId: users[1].id,
    authorName: users[1].fullName,
    coverUrl: '/images/courses/algos.png',
    title: 'Алгоритмы и структуры данных для собеседований',
    description: 'Разбор алгоритмов и структур данных, которые часто спрашивают на собеседованиях.',
    difficulty: 'Middle',
    language: 'JavaScript',
    tags: ['Algorithms', 'Data Structures', 'Leetcode'],
    estimatedDuration: 15,
    version: 1,
    isPublished: true,
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
    authorId: users[0].id,
    authorName: users[0].fullName,
    coverUrl: '/images/courses/anal.png',
    title: 'Интервью аналитика: SQL, Excel, кейсы',
    description: 'Всё, что нужно для успешного прохождения собеседования на позицию аналитика.',
    difficulty: 'Beginner',
    language: 'SQL',
    tags: ['SQL', 'Analytics', 'Excel'],
    estimatedDuration: 12,
    version: 1,
    isPublished: true,
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
    authorId: users[1].id,
    authorName: users[1].fullName,
    coverUrl: '/images/courses/softs.png',
    title: 'Расскажи о себе: soft skills на собеседовании',
    description: 'Как успешно презентовать себя и свои навыки на собеседовании.',
    difficulty: 'Beginner',
    language: 'Русский',
    tags: ['Soft skills', 'HR', 'Interview'],
    estimatedDuration: 8,
    version: 1,
    isPublished: true,
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
    authorId: users[0].id,
    authorName: users[0].fullName,
    coverUrl: '/images/courses/sysdis.png',
    title: 'System Design для Senior',
    description: 'Подготовка к вопросам по системному дизайну для позиции Senior Developer.',
    difficulty: 'Senior',
    language: 'English',
    tags: ['System Design', 'Architecture', 'Senior'],
    estimatedDuration: 25,
    version: 1,
    isPublished: true,
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
    authorId: users[1].id,
    authorName: users[1].fullName,
    coverUrl: '/images/courses/js.png',
    title: 'JavaScript для Junior Frontend',
    description: 'Всё, что нужно знать Junior Frontend разработчику о JavaScript.',
    difficulty: 'Beginner',
    language: 'JavaScript',
    tags: ['JavaScript', 'Frontend', 'Web'],
    estimatedDuration: 18,
    version: 1,
    isPublished: true,
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

// Уроки (полный контент)
const lessons = [
  {
    id: '101',
    courseId: '1',
    title: 'Основы Python',
    type: 'Theory',
    hasQuiz: true,
    content: `# Основы Python для Middle разработчика
    
Этот урок охватывает ключевые аспекты Python, которые часто спрашивают на собеседованиях.

## Типы данных

Python имеет следующие встроенные типы данных:
- Числа (int, float, complex)
- Строки (str)
- Списки (list)
- Кортежи (tuple)
- Словари (dict)
- Множества (set, frozenset)

## GIL (Global Interpreter Lock)

GIL - это механизм в интерпретаторе CPython, который позволяет только одному потоку исполнять Python байт-код в любой момент времени.`,
    videoUrl: 'https://example.com/videos/python-basics',
    quiz: [
      {
        id: uuidv4(),
        text: 'Что такое GIL в Python?',
        type: 'longText'
      },
      {
        id: uuidv4(),
        text: 'Выберите все встроенные типы данных в Python:',
        type: 'choice',
        options: [
          { id: '1', label: 'int' },
          { id: '2', label: 'array' },
          { id: '3', label: 'dict' },
          { id: '4', label: 'queue' },
          { id: '5', label: 'set' }
        ]
      }
    ]
  },
  // Остальные уроки можно добавить аналогично
];

// Записи на курсы
const enrollments = [
  {
    userId: users[2].id,
    courseId: '1',
    status: 'inProgress',
    progress: 65,
    startedAt: new Date('2023-05-01'),
    finishedAt: null
  },
  {
    userId: users[2].id,
    courseId: '3',
    status: 'completed',
    progress: 100,
    startedAt: new Date('2023-04-15'),
    finishedAt: new Date('2023-05-10')
  }
];

// Оценки курсов
const ratings = [
  {
    userId: users[2].id,
    courseId: '3',
    value: 5,
    createdAt: new Date('2023-05-11')
  }
];

module.exports = {
  users,
  courses,
  lessons,
  enrollments,
  ratings
};