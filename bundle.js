// ==== File: backend/config/config.js ====
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-for-development',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  environment: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'https://api.offer-hunt.com/v1',
  
  // Параметры подключения к базе данных
  dbUser: process.env.DB_USER || 'postgres',
  dbHost: process.env.DB_HOST || 'localhost',
  dbName: process.env.DB_NAME || 'offer_hunt',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  dbPort: process.env.DB_PORT || 5432,
  dbSsl: process.env.DB_SSL === 'true',
};

// ==== File: backend/config/db.js ====
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  user: config.dbUser,
  host: config.dbHost,
  database: config.dbName,
  password: config.dbPassword,
  port: config.dbPort,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false
});

// Проверка соединения с базой данных
pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));

// Вспомогательная функция для выполнения запросов
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool
};

// ==== File: backend/controllers/authController.js ====
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user
 * @route POST /auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Проверяем, существует ли уже пользователь с таким email
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email уже зарегистрирован'
      });
    }

    // Создаем нового пользователя
    const newUser = await User.create({
      email,
      password,
      fullName: fullName || email.split('@')[0] // Временное имя по умолчанию
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при регистрации'
    });
  }
};

/**
 * Login user
 * @route POST /auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Находим пользователя по email (получаем полные данные включая пароль)
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    // Проверяем пароль
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    // Генерируем токен
    const token = generateToken({
      id: user.id, 
      email: user.email, 
    });

    // Форматируем данные пользователя для ответа (без пароля)
    const userForResponse = User.formatUserData(user);

    res.status(200).json({
      accessToken: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при входе'
    });
  }
};

module.exports = {
  register,
  login
};

// ==== File: backend/controllers/courseController.js ====
const Course = require('../models/Course');

/**
 * Get all courses with filtering
 * @route GET /courses
 */
const getCourses = async (req, res) => {
  try {
    const { search, difficulty, sort, tags } = req.query;
    
    // Преобразуем строку тегов в массив, если они переданы
    const tagsArray = tags ? 
      (Array.isArray(tags) ? tags : tags.split(',')) : 
      [];
    
    const filters = {
      search,
      difficulty,
      sort,
      tags: tagsArray
    };
    
    const courses = await Course.findAll(filters);
    
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении курсов'
    });
  }
};

/**
 * Get single course by ID
 * @route GET /courses/:courseId
 */
const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { version } = req.query;
    
    const course = await Course.findById(courseId, version ? parseInt(version) : null);
    
    if (!course) {
      return res.status(404).json({
        code: 'COURSE_NOT_FOUND',
        message: 'Курс не найден'
      });
    }
    
    res.status(200).json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении курса'
    });
  }
};

/**
 * Create a new course
 * @route POST /courses
 */
const createCourse = async (req, res) => {
  try {
    const courseData = req.body;
    const authorId = req.user.id;
    
    const newCourse = await Course.create(courseData, authorId);
    
    res.status(201).json(newCourse);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при создании курса'
    });
  }
};

/**
 * Update a course
 * @route PUT /courses/:courseId
 */
const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;
    const authorId = req.user.id;
    
    try {
      const updatedCourse = await Course.update(courseId, updateData, authorId);
      res.status(200).json(updatedCourse);
    } catch (error) {
      if (error.message === 'Course not found or not authorized') {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Вы не являетесь автором этого курса'
        });
      } else if (error.message === 'Cannot update published course') {
        return res.status(403).json({
          code: 'ALREADY_PUBLISHED',
          message: 'Нельзя редактировать опубликованный курс. Создайте новую версию.'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при обновлении курса'
    });
  }
};

/**
 * Publish a course
 * @route POST /courses/:courseId/publish
 */
const publishCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const authorId = req.user.id;
    
    try {
      const publishedCourse = await Course.publish(courseId, authorId);
      res.status(200).json(publishedCourse);
    } catch (error) {
      if (error.message === 'Course not found or not authorized') {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Вы не являетесь автором этого курса'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Publish course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при публикации курса'
    });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  publishCourse
};

// ==== File: backend/controllers/enrollmentController.js ====
const Enrollment = require('../models/Enrollment');

/**
 * Enroll in a course
 * @route POST /courses/:courseId/enroll
 */
const enrollCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    try {
      const enrollment = await Enrollment.enrollCourse(userId, courseId);
      res.status(201).json(enrollment);
    } catch (error) {
      if (error.message === 'Already enrolled') {
        return res.status(409).json({
          code: 'ALREADY_ENROLLED',
          message: 'Вы уже записаны на этот курс'
        });
      } else if (error.message === 'Course not found or not published') {
        return res.status(404).json({
          code: 'COURSE_NOT_FOUND',
          message: 'Курс не найден или не опубликован'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Enroll course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при записи на курс'
    });
  }
};

/**
 * Get enrollment progress
 * @route GET /courses/:courseId/progress
 */
const getProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    
    const progress = await Enrollment.getProgress(userId, courseId);
    
    if (!progress) {
      return res.status(404).json({
        code: 'ENROLLMENT_NOT_FOUND',
        message: 'Вы не записаны на этот курс'
      });
    }
    
    res.status(200).json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении прогресса'
    });
  }
};

/**
 * Rate a course
 * @route POST /courses/:courseId/rating
 */
const rateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { value } = req.body;
    const userId = req.user.id;
    
    if (!value || value < 1 || value > 5) {
      return res.status(400).json({
        code: 'INVALID_RATING',
        message: 'Оценка должна быть от 1 до 5'
      });
    }
    
    try {
      const rating = await Enrollment.rateCourse(userId, courseId, value);
      res.status(201).json(rating);
    } catch (error) {
      if (error.message === 'Not enrolled in the course') {
        return res.status(403).json({
          code: 'NOT_ENROLLED',
          message: 'Вы не записаны на этот курс'
        });
      } else if (error.message === 'Already rated') {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Вы уже оценили этот курс'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Rate course error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при оценке курса'
    });
  }
};

module.exports = {
  enrollCourse,
  getProgress,
  rateCourse
};

// ==== File: backend/controllers/userController.js ====
const User = require('../models/User');
const Course = require('../models/Course'); // Add Course model
const Enrollment = require('../models/Enrollment'); // Add Enrollment model
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Get current user profile
 * @route GET /users/me
 */
const getMe = async (req, res) => {
  console.log('getMe controller called, user ID:', req.user.id);
  try {
    // Находим пользователя по ID из токена
    const user = await User.findById(req.user.id);
    
    if (!user) {
      console.log('User not found in database');
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Пользователь не найден'
      });
    }

    console.log('User found, returning data');
    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении профиля'
    });
  }
};

/**
 * Update user profile
 * @route PATCH /users/me
 */
const updateMe = async (req, res) => {
  try {
    // Обновляем данные пользователя
    const { fullName, avatarUrl } = req.body;
    
    const updatedUser = await User.update(req.user.id, {
      fullName,
      avatarUrl
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при обновлении профиля'
    });
  }
};

/**
 * Upload user avatar
 * @route POST /users/me/avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({
        code: 'NO_FILE',
        message: 'Файл не найден'
      });
    }

    const avatar = req.files.avatar;
    
    // Проверяем тип файла
    if (!avatar.mimetype.startsWith('image/')) {
      return res.status(400).json({
        code: 'INVALID_FILE_TYPE',
        message: 'Файл должен быть изображением'
      });
    }
    
    // Проверяем размер файла (ограничение 5MB)
    if (avatar.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        code: 'FILE_TOO_LARGE',
        message: 'Размер файла не должен превышать 5MB'
      });
    }
    
    // Создаем уникальное имя файла
    const fileExt = path.extname(avatar.name);
    const fileName = `${uuidv4()}${fileExt}`;
    
    // Путь для сохранения файла
    const uploadDir = path.join(__dirname, '../public/uploads/avatars');
    
    // Убедимся, что папка существует
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, fileName);
    
    // Сохраняем файл
    await avatar.mv(filePath);
    
    // URL для доступа к аватару
    const avatarUrl = `/uploads/avatars/${fileName}`;
    
    // Обновляем URL аватара в профиле пользователя
    await User.update(req.user.id, { avatarUrl });
    
    res.status(200).json({ avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при загрузке аватара'
    });
  }
};

/**
 * Get user's enrollments by status
 * @route GET /users/me/enrollments
 */
const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query; // 'inProgress' or 'completed'

    if (!status || !['inProgress', 'completed'].includes(status)) {
      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Необходимо указать статус: inProgress или completed'
      });
    }

    const enrollments = await Enrollment.findByUserAndStatus(userId, status);
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении записей на курсы'
    });
  }
};

/**
 * Get courses created by the user
 * @route GET /users/me/courses
 */
const getMyCreatedCourses = async (req, res) => {
  try {
    const authorId = req.user.id;

    // Дополнительная проверка роли (хотя можно положиться на middleware)

    const courses = await Course.findByAuthor(authorId);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get created courses error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении созданных курсов'
    });
  }
};

module.exports = {
  getMe,
  updateMe,
  uploadAvatar,
  getMyEnrollments,     // <-- Add export
  getMyCreatedCourses   // <-- Add export
};

// ==== File: backend/data/mockData.js ====
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

// ==== File: backend/middleware/auth.js ====
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to protect routes that require authentication
 */
const protect = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Требуется авторизация'
    });
  }

  // Extract token
  const token = authHeader.split(' ')[1];

  // Verify token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Недействительный токен'
    });
  }

  // Set user on request object
  req.user = decoded;
  next();
};

module.exports = {
  protect,
};

// ==== File: backend/middleware/errorHandler.js ====
/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Что-то пошло не так';

  res.status(statusCode).json({
    code: errorCode,
    message
  });
};

module.exports = errorHandler;

// ==== File: backend/models/Course.js ====
// ===== ./backend/models/Course.js =====
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid'); // Keep if used for lessons/questions internally

/**
 * Получение тегов курса (Helper Function)
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив тегов
 */
const getCourseTags = async (courseId) => {
    const result = await db.query(
        'SELECT tag FROM course_tags WHERE course_id = $1 ORDER BY tag', // Added ORDER BY for consistency
        [courseId]
    );
    return result.rows.map(row => row.tag);
};

/**
 * Получение уроков курса (Summary) (Helper Function)
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив уроков (summary)
 */
const getCourseLessons = async (courseId) => {
    const result = await db.query(
        `SELECT
          l.id,
          l.title,
          l.type,
          CASE WHEN EXISTS (
            SELECT 1 FROM questions q WHERE q.lesson_id = l.id
          ) THEN true ELSE false END AS has_quiz
         FROM
          lessons l
         WHERE
          l.course_id = $1
         ORDER BY
          l.sort_order`,
        [courseId]
    );
    // Map to ensure consistent keys (camelCase) expected by frontend
    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type, // Assuming 'Theory' / 'Coding' match enum
        hasQuiz: row.has_quiz
    }));
};

/**
 * Форматирование данных курса для API (Helper Function)
 * @param {Object} courseData - Данные курса из базы (row)
 * @param {Array} tags - Теги курса
 * @param {Array} lessons - Уроки курса (summary)
 * @returns {Object} - Форматированные данные курса
 */
const formatCourseData = (courseData, tags, lessons) => {
    // Ensure stats are numbers and handle nulls gracefully
    const stats = {
        enrollments: parseInt(courseData.enrollments, 10) || 0,
        avgCompletion: parseFloat(courseData.avg_completion) || 0,
        avgScore: parseFloat(courseData.avg_score) || 0.0 // Default to 0.0
    };

    return {
        id: courseData.id,
        authorId: courseData.author_id,
        authorName: courseData.author_name, // Comes from JOIN in queries
        title: courseData.title,
        description: courseData.description,
        difficulty: courseData.difficulty, // Ensure matches 'Beginner', 'Middle', 'Senior'
        language: courseData.language,
        coverUrl: courseData.cover_url,
        tags: tags || [], // Ensure tags is always an array
        estimatedDuration: courseData.estimated_duration, // Frontend handles null if needed
        version: courseData.version,
        isPublished: courseData.is_published,
        stats: stats,
        lessons: lessons || [] // Ensure lessons is always an array
    };
};


/**
 * Получение всех курсов с фильтрацией
 * @param {Object} filters - Параметры фильтрации
 * @returns {Promise<Array>} - Массив курсов
 */
const findAll = async (filters = {}) => {
    // The 'tags' in filters is expected to be an array of strings, e.g., ['Python', 'JavaScript']
    const { search, difficulty, sort, tags = [], language } = filters;

    let query = `
      SELECT
        c.id,
        c.author_id,
        u.full_name AS author_name,
        c.title,
        c.description,
        c.difficulty,
        c.language,
        c.cover_url,
        c.estimated_duration,
        c.version,
        c.is_published,
        COALESCE(cs.enrollments, 0) AS enrollments,
        COALESCE(cs.avg_completion, 0) AS avg_completion,
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
    `;

    const whereConditions = [];
    const values = [];
    let valueCounter = 1;

    whereConditions.push(`c.is_published = true`);

    if (search) {
        whereConditions.push(`(
          c.title ILIKE $${valueCounter}
          OR c.description ILIKE $${valueCounter}
          OR u.full_name ILIKE $${valueCounter}
          OR EXISTS (
            SELECT 1 FROM course_tags ct_search
            WHERE ct_search.course_id = c.id AND ct_search.tag ILIKE $${valueCounter}
          )
        )`);
        values.push(`%${search}%`);
        valueCounter++;
    }

    if (difficulty) {
        whereConditions.push(`c.difficulty = $${valueCounter}`);
        values.push(difficulty);
        valueCounter++;
    }

    if (language) {
        whereConditions.push(`c.language = $${valueCounter}`);
        values.push(language);
        valueCounter++;
    }

    // Tags Filter
    if (tags && tags.length > 0) {
        // Ensure 'tags' is a flat array of strings.
        // The controller should already provide this.
        const flatTags = tags.flat(); // Just in case, though controller should handle it.
        if (flatTags.length > 0) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM course_tags ct
                WHERE ct.course_id = c.id AND ct.tag = ANY($${valueCounter})
            )`);
            values.push(flatTags); // Ensure this is a flat array ['tag1', 'tag2']
            valueCounter++;
        }
    }

    if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Sorting (remains the same)
    let orderByClause = ` ORDER BY c.created_at DESC`;
    if (sort) { /* ... sorting logic ... */ }
    query += orderByClause;

    console.log("Executing Course FindAll Query:", query);
    console.log("Query Values for FindAll:", values); // Changed log label

    const result = await db.query(query, values);

    const coursesData = await Promise.all(result.rows.map(async courseRow => {
        const courseTagsList = await getCourseTags(courseRow.id);
        const courseLessonsList = await getCourseLessons(courseRow.id);
        return formatCourseData(courseRow, courseTagsList, courseLessonsList);
    }));

    return coursesData;
};

/**
 * Получение курса по ID
 * @param {string} id - ID курса
 * @param {number} version - Версия курса (опционально)
 * @returns {Promise<Object|null>} - Найденный курс или null
 */
const findById = async (id, version = null) => {
    let query = `
      SELECT
        c.id,
        c.author_id,
        u.full_name AS author_name,
        c.title,
        c.description,
        c.difficulty,
        c.language,
        c.cover_url,
        c.estimated_duration,
        c.version,
        c.is_published,
        COALESCE(cs.enrollments, 0) AS enrollments,
        COALESCE(cs.avg_completion, 0) AS avg_completion,
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
      WHERE c.id = $1
    `;

    const values = [id];

    if (version) {
        query += ` AND c.version = $2`;
        values.push(version);
    } else {
        // If no specific version requested, usually get the latest published or the draft
        // For simplicity, let's assume getting *any* version by ID is okay for now.
        // More complex logic might be needed (e.g., get highest version number).
    }

     // Limit to 1 in case multiple versions exist and no specific one was asked for
    query += ` ORDER BY c.version DESC LIMIT 1`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
        return null;
    }

    const courseRow = result.rows[0];
    const tags = await getCourseTags(id); // Use the found course's ID
    const lessons = await getCourseLessons(id); // Use the found course's ID

    return formatCourseData(courseRow, tags, lessons);
};

/**
 * Создание нового курса (черновик)
 * @param {Object} courseData - Данные курса (title, description, difficulty, etc.)
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Созданный курс
 */
const create = async (courseData, authorId) => {
    const {
        title,
        description,
        difficulty,
        language = null, // Default to null if not provided
        tags = [],
        lessons = [], // Expect full lesson structure for creation
        coverUrl = null, // Allow setting cover URL during creation
        estimatedDuration = null // Allow setting duration
    } = courseData;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create course record (version 1, unpublished)
        const courseResult = await client.query(
            `INSERT INTO courses
              (author_id, title, description, difficulty, language, cover_url, estimated_duration, version, is_published)
             VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [authorId, title, description, difficulty, language, coverUrl, estimatedDuration, 1, false] // Start as unpublished draft
        );
        const course = courseResult.rows[0];
        const courseId = course.id;

        // 2. Create initial course stats
        await client.query(
            `INSERT INTO course_stats (course_id, enrollments, avg_completion, avg_score) VALUES ($1, 0, 0, 0)`,
            [courseId]
        );

        // 3. Add tags
        if (tags.length > 0) {
            const tagValues = tags.map((tag, index) => `($1, $${index + 2})`).join(', ');
            const tagParams = [courseId, ...tags];
            await client.query(
                `INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`,
                tagParams
            );
        }

        // 4. Add lessons and their content/quizzes
        if (lessons.length > 0) {
            for (let i = 0; i < lessons.length; i++) {
                const lesson = lessons[i];
                const lessonResult = await client.query(
                    `INSERT INTO lessons (course_id, title, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
                    [courseId, lesson.title, lesson.type, i]
                );
                const lessonId = lessonResult.rows[0].id;

                // Add lesson content
                await client.query(
                    `INSERT INTO lesson_content (lesson_id, content, video_url) VALUES ($1, $2, $3)`,
                    [lessonId, lesson.content || '', lesson.videoUrl || null]
                );

                // Add quiz questions and options
                if (lesson.quiz && lesson.quiz.length > 0) {
                    for (let j = 0; j < lesson.quiz.length; j++) {
                        const question = lesson.quiz[j];
                        const questionResult = await client.query(
                            `INSERT INTO questions (lesson_id, text, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
                            [lessonId, question.text, question.type, j]
                        );
                        const questionId = questionResult.rows[0].id;

                        if (question.type === 'choice' && question.options && question.options.length > 0) {
                            for (let k = 0; k < question.options.length; k++) {
                                const option = question.options[k];
                                await client.query(
                                    `INSERT INTO question_options (question_id, label, is_correct, sort_order) VALUES ($1, $2, $3, $4)`,
                                    // Assuming frontend might send 'is_correct', defaulting to false if not
                                    [questionId, option.label, option.is_correct || false, k]
                                );
                            }
                        }
                    }
                }
            }
        }

         // Recalculate estimated duration if not provided initially (optional)
         if (estimatedDuration === null) {
             const calculatedDuration = Math.ceil(lessons.length * 1.5); // Example calculation
             await client.query('UPDATE courses SET estimated_duration = $1 WHERE id = $2', [calculatedDuration, courseId]);
             course.estimated_duration = calculatedDuration; // Update object in memory
         }


        await client.query('COMMIT');

        // Return the newly created course with details
        return await findById(courseId); // Use findById to get formatted data

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating course:", error);
        throw error; // Re-throw the error for the controller
    } finally {
        client.release();
    }
};

/**
 * Обновление курса (только черновика)
 * @param {string} id - ID курса
 * @param {Object} updateData - Данные для обновления
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Обновленный курс
 */
const update = async (id, updateData, authorId) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check if course exists, belongs to author, and is unpublished
        const courseCheck = await client.query(
            'SELECT id, is_published FROM courses WHERE id = $1 AND author_id = $2',
            [id, authorId]
        );
        if (courseCheck.rows.length === 0) {
            throw new Error('Course not found or not authorized');
        }
        if (courseCheck.rows[0].is_published) {
            throw new Error('Cannot update published course');
        }

        const {
            title, description, difficulty, language, tags, lessons, // Expect full lessons array for update
            coverUrl, estimatedDuration
        } = updateData;

        // 2. Update basic course fields
        const updateFields = [];
        const values = [];
        let counter = 1;

        // Helper to add field to update query
        const addUpdateField = (field, value) => {
            if (value !== undefined) {
                updateFields.push(`${field} = $${counter}`);
                values.push(value);
                counter++;
            }
        };

        addUpdateField('title', title);
        addUpdateField('description', description);
        addUpdateField('difficulty', difficulty);
        addUpdateField('language', language);
        addUpdateField('cover_url', coverUrl);
        addUpdateField('estimated_duration', estimatedDuration);

        if (updateFields.length > 0) {
            values.push(id); // Add course ID for WHERE clause
            await client.query(
                `UPDATE courses SET ${updateFields.join(', ')} WHERE id = $${counter}`,
                values
            );
        }

        // 3. Update tags (delete existing, insert new)
        if (tags !== undefined) {
            await client.query('DELETE FROM course_tags WHERE course_id = $1', [id]);
            if (tags.length > 0) {
                const tagValues = tags.map((tag, index) => `($1, $${index + 2})`).join(', ');
                const tagParams = [id, ...tags];
                await client.query(`INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`, tagParams);
            }
        }

        // 4. Update lessons (complex: delete old, insert/update new)
        if (lessons !== undefined) {
             // Get IDs of lessons currently associated with the course
             const existingLessonsResult = await client.query('SELECT id FROM lessons WHERE course_id = $1', [id]);
             const existingLessonIds = new Set(existingLessonsResult.rows.map(r => r.id));
             const updatedLessonIds = new Set();

             // Iterate through lessons provided in the update
            for (let i = 0; i < lessons.length; i++) {
                const lesson = lessons[i];
                let lessonId = lesson.id; // Use provided ID if exists

                 if (lessonId && existingLessonIds.has(lessonId)) {
                     // Update existing lesson
                    await client.query(
                        'UPDATE lessons SET title = $1, type = $2, sort_order = $3 WHERE id = $4',
                        [lesson.title, lesson.type, i, lessonId]
                    );
                    updatedLessonIds.add(lessonId);
                 } else {
                     // Insert new lesson (ignore any incoming ID if it wasn't existing)
                    const newLessonResult = await client.query(
                        'INSERT INTO lessons (course_id, title, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
                        [id, lesson.title, lesson.type, i]
                    );
                    lessonId = newLessonResult.rows[0].id; // Get the newly generated ID
                    updatedLessonIds.add(lessonId);
                 }

                 // Update lesson content (upsert logic)
                await client.query(
                    `INSERT INTO lesson_content (lesson_id, content, video_url) VALUES ($1, $2, $3)
                     ON CONFLICT (lesson_id) DO UPDATE SET content = EXCLUDED.content, video_url = EXCLUDED.video_url`,
                    [lessonId, lesson.content || '', lesson.videoUrl || null]
                );

                 // Update quiz (delete all old questions for this lesson, insert new)
                await client.query('DELETE FROM questions WHERE lesson_id = $1', [lessonId]);
                if (lesson.quiz && lesson.quiz.length > 0) {
                    for (let j = 0; j < lesson.quiz.length; j++) {
                        const question = lesson.quiz[j];
                        const questionResult = await client.query(
                            'INSERT INTO questions (lesson_id, text, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
                            [lessonId, question.text, question.type, j]
                        );
                        const questionId = questionResult.rows[0].id;

                        if (question.type === 'choice' && question.options && question.options.length > 0) {
                            for (let k = 0; k < question.options.length; k++) {
                                const option = question.options[k];
                                await client.query(
                                    'INSERT INTO question_options (question_id, label, is_correct, sort_order) VALUES ($1, $2, $3, $4)',
                                    [questionId, option.label, option.is_correct || false, k]
                                );
                            }
                        }
                    }
                }
            }

            // Delete lessons that were previously associated but are not in the updated list
            for (const existingId of existingLessonIds) {
                if (!updatedLessonIds.has(existingId)) {
                    await client.query('DELETE FROM lessons WHERE id = $1', [existingId]);
                }
            }

             // Optional: Recalculate estimated duration based on new lesson count if not explicitly set
             if (estimatedDuration === undefined) { // Only if duration wasn't part of the updateData
                 const newDuration = Math.ceil(lessons.length * 1.5);
                 await client.query('UPDATE courses SET estimated_duration = $1 WHERE id = $2', [newDuration, id]);
             }
        }


        await client.query('COMMIT');

        // Return the updated course details
        return await findById(id);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating course:", error);
        throw error; // Re-throw for controller
    } finally {
        client.release();
    }
};

/**
 * Публикация курса (увеличивает версию)
 * @param {string} id - ID курса
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Опубликованный курс
 */
const publish = async (id, authorId) => {
    // 1. Check if course exists and belongs to the author
    const courseCheck = await db.query(
        'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
        [id, authorId]
    );
    if (courseCheck.rows.length === 0) {
        throw new Error('Course not found or not authorized');
    }

    // 2. Update course: set is_published = true, increment version
    // NOTE: In a real system, publishing might involve creating a *new* course record
    // with the incremented version, keeping the old one immutable.
    // This simplified version updates the existing record.
    const result = await db.query(
        'UPDATE courses SET is_published = true, version = version + 1 WHERE id = $1 RETURNING id',
        [id]
    );

    // 3. Return the newly published course details
    return await findById(id);
};

/**
 * Получение курсов по ID автора
 * @param {string} authorId - ID автора
 * @returns {Promise<Array>} - Массив курсов автора
 */
const findByAuthor = async (authorId) => {
    const query = `
      SELECT
        c.id,
        c.author_id,
        u.full_name AS author_name,
        c.title,
        c.description,
        c.difficulty,
        c.language,
        c.cover_url,
        c.estimated_duration,
        c.version,
        c.is_published,
        COALESCE(cs.enrollments, 0) AS enrollments,
        COALESCE(cs.avg_completion, 0) AS avg_completion,
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
      WHERE
        c.author_id = $1
      ORDER BY
        c.created_at DESC;
    `;

    const result = await db.query(query, [authorId]);

    // Get tags and lessons for each course
    const courses = await Promise.all(result.rows.map(async courseRow => {
        const tags = await getCourseTags(courseRow.id);
        const lessons = await getCourseLessons(courseRow.id);
        return formatCourseData(courseRow, tags, lessons);
    }));

    return courses;
};


// --- IMPORTANT: Define ALL functions before exporting ---

module.exports = {
    findAll,
    findById, // Ensure this is defined ABOVE this line
    create,
    update,
    publish,
    findByAuthor,
    // Export helpers ONLY if they are needed by other models (like Enrollment.js)
    getCourseTags,
    getCourseLessons,
    formatCourseData
};

// ==== File: backend/models/Enrollment.js ====
// ===== ./models/Enrollment.js =====
const db = require('../config/db');
const Course = require('./Course'); // We might need Course formatting

/**
 * Получение записей пользователя на курсы по статусу
 * @param {string} userId - ID пользователя
 * @param {string} status - Статус ('inProgress', 'completed')
 * @returns {Promise<Array>} - Массив записей с данными курсов
 */
const findByUserAndStatus = async (userId, status) => {
  const query = `
    SELECT 
      e.course_id,
      e.status,
      e.progress,
      e.started_at,
      e.finished_at,
      c.id, 
      c.author_id, 
      u.full_name AS author_name,
      c.title, 
      c.description, 
      c.difficulty, 
      c.language, 
      c.cover_url, 
      c.estimated_duration, 
      c.version, 
      c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments, 
      COALESCE(cs.avg_completion, 0) AS avg_completion, 
      COALESCE(cs.avg_score, 0) AS avg_score,
      -- Получаем оценку пользователя, если курс завершен
      CASE 
        WHEN e.status = 'completed' THEN (
          SELECT r.value 
          FROM ratings r 
          WHERE r.course_id = c.id AND r.user_id = e.user_id
          LIMIT 1
        ) 
        ELSE NULL 
      END AS user_rating
    FROM 
      enrollments e
    JOIN 
      courses c ON e.course_id = c.id
    JOIN 
      users u ON c.author_id = u.id
    LEFT JOIN 
      course_stats cs ON c.id = cs.course_id
    WHERE 
      e.user_id = $1 AND e.status = $2
    ORDER BY 
      e.started_at DESC;
  `;

  const result = await db.query(query, [userId, status]);

  // Получаем теги и уроки для каждого курса (может быть избыточно, зависит от дизайна карточки)
  const enrollmentsWithDetails = await Promise.all(result.rows.map(async row => {
    const tags = await Course.getCourseTags(row.course_id); // Используем функцию из Course модели
    const lessons = await Course.getCourseLessons(row.course_id); // Используем функцию из Course модели

    const formattedCourse = Course.formatCourseData(row, tags, lessons); // Форматируем данные курса

    return {
      // Данные записи (enrollment)
      status: row.status,
      progress: row.progress,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      userRating: row.user_rating, // Оценка пользователя для завершенных
      // Данные курса (вложенный объект)
      course: formattedCourse
    };
  }));

  return enrollmentsWithDetails;
};


/**
 * Запись пользователя на курс
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object>} - Созданная запись
 */
const enrollCourse = async (userId, courseId) => {
  // Проверяем, опубликован ли курс
  const courseResult = await db.query(
    'SELECT is_published FROM courses WHERE id = $1',
    [courseId]
  );
  if (courseResult.rows.length === 0 || !courseResult.rows[0].is_published) {
    throw new Error('Course not found or not published');
  }

  // Проверяем, не записан ли уже пользователь
  const existingEnrollment = await db.query(
    'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  if (existingEnrollment.rows.length > 0) {
    throw new Error('Already enrolled');
  }

  // Создаем запись
  const result = await db.query(
    `INSERT INTO enrollments 
       (user_id, course_id, status, progress, started_at) 
     VALUES 
       ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
     RETURNING *`,
    [userId, courseId, 'inProgress', 0]
  );

  // Обновляем статистику курса
  await db.query(
    `UPDATE course_stats 
     SET enrollments = enrollments + 1 
     WHERE course_id = $1`,
    [courseId]
  );

  // Обновляем статистику пользователя
  await db.query(
    `UPDATE user_stats 
     SET active_courses = active_courses + 1 
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0]; // Возвращаем базовые данные записи
};

/**
 * Получение прогресса пользователя по курсу
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object|null>} - Данные прогресса или null
 */
const getProgress = async (userId, courseId) => {
  const result = await db.query(
    'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Оценка курса пользователем
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @param {number} value - Оценка (1-5)
 * @returns {Promise<Object>} - Созданная оценка
 */
const rateCourse = async (userId, courseId, value) => {
  // Проверяем, записан ли пользователь на курс
  const enrollment = await getProgress(userId, courseId);
  if (!enrollment) {
    throw new Error('Not enrolled in the course');
  }
  // Опционально: разрешить оценку только завершенных курсов
  // if (enrollment.status !== 'completed') {
  //   throw new Error('Course must be completed to rate');
  // }

  // Проверяем, не оценил ли уже пользователь
  const existingRating = await db.query(
    'SELECT 1 FROM ratings WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  if (existingRating.rows.length > 0) {
    throw new Error('Already rated');
  }

  // Создаем оценку
  const result = await db.query(
    `INSERT INTO ratings 
       (user_id, course_id, value, created_at) 
     VALUES 
       ($1, $2, $3, CURRENT_TIMESTAMP) 
     RETURNING *`,
    [userId, courseId, value]
  );

  // Обновляем среднюю оценку курса
  await db.query(
    `UPDATE course_stats 
     SET avg_score = 
       (SELECT AVG(value)::numeric(5,2) FROM ratings WHERE course_id = $1) 
     WHERE course_id = $1`,
    [courseId]
  );

  return result.rows[0];
};


module.exports = {
  findByUserAndStatus,
  enrollCourse,
  getProgress,
  rateCourse
};

// ==== File: backend/models/Lesson.js ====


// ==== File: backend/models/Rating.js ====


// ==== File: backend/models/User.js ====
const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Поиск пользователя по email
 * @param {string} email - Email пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findByEmail = async (email) => {
  const result = await db.query(
    'SELECT u.*, us.active_courses, us.completed_courses, us.avg_score FROM users u ' +
    'LEFT JOIN user_stats us ON u.id = us.user_id ' +
    'WHERE u.email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  // ВАЖНО: Возвращаем полный объект включая password для внутреннего использования
  // Не форматируем данные здесь, чтобы сохранить password
  return result.rows[0];
};

/**
 * Поиск пользователя по ID
 * @param {string} id - ID пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findById = async (id) => {
  const result = await db.query(
    'SELECT u.*, us.active_courses, us.completed_courses, us.avg_score FROM users u ' +
    'LEFT JOIN user_stats us ON u.id = us.user_id ' +
    'WHERE u.id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  // Здесь форматируем данные, т.к. этот метод используется для API ответов
  return formatUserData(result.rows[0]);
};

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise<Object>} - Созданный пользователь
 */
const create = async (userData) => {
  const { email, password, fullName = null } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Транзакция для создания пользователя и его статистики
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Создаем пользователя
    const userResult = await client.query(
      'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, fullName]
    );
    
    const user = userResult.rows[0];
    
    // Создаем запись статистики
    await client.query(
      'INSERT INTO user_stats (user_id, active_courses, completed_courses, avg_score) VALUES ($1, $2, $3, $4)',
      [user.id, 0, 0, 0]
    );
    
    await client.query('COMMIT');
    
    // Получаем полную информацию о пользователе
    const fullUser = await findById(user.id);
    return fullUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Обновление данных пользователя
 * @param {string} id - ID пользователя
 * @param {Object} updateData - Данные для обновления
 * @returns {Promise<Object>} - Обновленный пользователь
 */
const update = async (id, updateData) => {
  const { fullName, avatarUrl } = updateData;
  const updateFields = [];
  const values = [];
  let counter = 1;
  
  if (fullName !== undefined) {
    updateFields.push(`full_name = $${counter}`);
    values.push(fullName);
    counter++;
  }
  
  if (avatarUrl !== undefined) {
    updateFields.push(`avatar_url = $${counter}`);
    values.push(avatarUrl);
    counter++;
  }
  
  if (updateFields.length === 0) {
    return await findById(id);
  }
  
  values.push(id);
  
  const result = await db.query(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${counter} RETURNING *`,
    values
  );
  
  return await findById(id);
};

/**
 * Форматирование данных пользователя для API
 * @param {Object} userData - Данные пользователя из базы
 * @returns {Object} - Форматированные данные пользователя
 */
const formatUserData = (userData) => {
  const { password, ...userWithoutPassword } = userData;
  
  return {
    id: userData.id,
    email: userData.email,
    fullName: userData.full_name,
    avatarUrl: userData.avatar_url,
    stats: {
      activeCourses: userData.active_courses || 0,
      completedCourses: userData.completed_courses || 0,
      avgScore: userData.avg_score || 0
    }
  };
};

/**
 * Проверка пароля
 * @param {string} password - Введенный пароль
 * @param {string} hashedPassword - Хэшированный пароль из базы
 * @returns {Promise<boolean>} - Результат проверки
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Обновление аватара пользователя
 * @param {string} id - ID пользователя
 * @param {string} avatarUrl - URL аватара
 * @returns {Promise<Object>} - Обновленный пользователь
 */
const updateAvatar = async (id, avatarUrl) => {
  await db.query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2',
    [avatarUrl, id]
  );
  
  return await findById(id);
};

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  comparePassword,
  updateAvatar,
  formatUserData // Экспортируем для использования в контроллере
};

// ==== File: backend/routes/authRoutes.js ====
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /auth/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post('/login', login);

module.exports = router;

// ==== File: backend/routes/courseRoutes.js ====
const express = require('express');
const router = express.Router();
const { 
  getCourses, 
  getCourseById, 
  createCourse, 
  updateCourse, 
  publishCourse 
} = require('../controllers/courseController');
const { 
  enrollCourse, 
  getProgress, 
  rateCourse 
} = require('../controllers/enrollmentController');
const { protect, authorOnly } = require('../middleware/auth');

/**
 * @route GET /courses
 * @desc Get all courses with filtering
 * @access Public/Private
 */
router.get('/', getCourses);

/**
 * @route POST /courses
 * @desc Create a new course
 * @access Private
 */
router.post('/', protect, createCourse);

/**
 * @route GET /courses/:courseId
 * @desc Get single course by ID
 * @access Public
 */
router.get('/:courseId', getCourseById);

/**
 * @route PUT /courses/:courseId
 * @desc Update a course
 * @access Private (Author only)
 */
router.put('/:courseId', protect, updateCourse);

/**
 * @route POST /courses/:courseId/publish
 * @desc Publish a course
 * @access Private (Author only)
 */
router.post('/:courseId/publish', protect, publishCourse);

/**
 * @route POST /courses/:courseId/enroll
 * @desc Enroll in a course
 * @access Private
 */
router.post('/:courseId/enroll', protect, enrollCourse);

/**
 * @route GET /courses/:courseId/progress
 * @desc Get enrollment progress
 * @access Private
 */
router.get('/:courseId/progress', protect, getProgress);

/**
 * @route POST /courses/:courseId/rating
 * @desc Rate a course
 * @access Private
 */
router.post('/:courseId/rating', protect, rateCourse);

module.exports = router;

// ==== File: backend/routes/enrollmentRoutes.js ====
const express = require('express');
const router = express.Router();
const { 
  enrollCourse, 
  getProgress, 
  rateCourse 
} = require('../controllers/enrollmentController');
const { protect } = require('../middleware/auth');

// Эти маршруты уже включены в courseRoutes.js для удобства
// Здесь они приведены для полноты, но их можно не использовать

/**
 * @route POST /courses/:courseId/enroll
 * @desc Enroll in a course
 * @access Private
 */
// router.post('/:courseId/enroll', protect, enrollCourse);

/**
 * @route GET /courses/:courseId/progress
 * @desc Get enrollment progress
 * @access Private
 */
// router.get('/:courseId/progress', protect, getProgress);

/**
 * @route POST /courses/:courseId/rating
 * @desc Rate a course
 * @access Private
 */
// router.post('/:courseId/rating', protect, rateCourse);

module.exports = router;

// ==== File: backend/routes/userRoutes.js ====
// ===== ./routes/userRoutes.js =====
const express = require('express');
const router = express.Router();
const {
  getMe,
  updateMe,
  uploadAvatar,
  getMyEnrollments,      // <-- Import new controller
  getMyCreatedCourses    // <-- Import new controller
} = require('../controllers/userController');
const { protect, authorOnly } = require('../middleware/auth'); // Import authorOnly if needed

/**
 * @route GET /users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', protect, getMe);

/**
 * @route PATCH /users/me
 * @desc Update user profile
 * @access Private
 */
router.patch('/me', protect, updateMe);

/**
 * @route POST /users/me/avatar
 * @desc Upload user avatar
 * @access Private
 */
router.post('/me/avatar', protect, uploadAvatar);

/**
 * @route GET /users/me/enrollments
 * @desc Get user's enrollments by status (inProgress or completed)
 * @access Private
 */
router.get('/me/enrollments', protect, getMyEnrollments);

/**
 * @route GET /users/me/courses
 * @desc Get courses created by the user
 * @access Private (Author Only - could use authorOnly middleware too)
 */
router.get('/me/courses', protect, getMyCreatedCourses); // Middleware protect is enough if controller checks role


module.exports = router;

// ==== File: backend/scripts/seed.js ====
/**
 * Скрипт для заполнения базы данных тестовыми данными
 * Запуск: node scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Тестовые данные
const users = [
  {
    email: 'ivan@example.com',
    password: 'password',
    fullName: 'Иван Иванов',
  },
  {
    email: 'polina@example.com',
    password: 'password',
    fullName: 'Полина Смирнова',
  },
  {
    email: 'user@example.com',
    password: 'password',
    fullName: 'Тестовый Пользователь',
  }
];

const courses = [
  {
    title: 'Подготовка к Python Middle собеседованию',
    description: 'Полноценный курс для подготовки к Python Middle собеседованиям.',
    difficulty: 'Middle',
    language: 'Python',
    coverUrl: '/images/courses/python.png',
    tags: ['Python', 'Backend', 'Algorithms'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы Python', type: 'Theory', hasQuiz: true },
      { title: 'Структуры данных', type: 'Theory', hasQuiz: true },
      { title: 'Алгоритмы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    title: 'Алгоритмы и структуры данных для собеседований',
    description: 'Разбор алгоритмов и структур данных, которые часто спрашивают на собеседованиях.',
    difficulty: 'Middle',
    language: 'JavaScript',
    coverUrl: '/images/courses/algos.png',
    tags: ['Algorithms', 'Data Structures', 'Leetcode'],
    authorIndex: 1,
    lessons: [
      { title: 'Сложность алгоритмов', type: 'Theory', hasQuiz: true },
      { title: 'Сортировки', type: 'Coding', hasQuiz: true },
      { title: 'Деревья и графы', type: 'Theory', hasQuiz: true }
    ]
  },
  {
    title: 'Интервью аналитика: SQL, Excel, кейсы',
    description: 'Всё, что нужно для успешного прохождения собеседования на позицию аналитика.',
    difficulty: 'Beginner',
    language: 'SQL',
    coverUrl: '/images/courses/anal.png',
    tags: ['SQL', 'Analytics', 'Excel'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы SQL', type: 'Theory', hasQuiz: true },
      { title: 'Сложные запросы', type: 'Coding', hasQuiz: true },
      { title: 'Аналитические кейсы', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    title: 'Расскажи о себе: soft skills на собеседовании',
    description: 'Как успешно презентовать себя и свои навыки на собеседовании.',
    difficulty: 'Beginner',
    language: 'Русский',
    coverUrl: '/images/courses/softs.png',
    tags: ['Soft skills', 'HR', 'Interview'],
    authorIndex: 1,
    lessons: [
      { title: 'Самопрезентация', type: 'Theory', hasQuiz: true },
      { title: 'Сложные вопросы', type: 'Theory', hasQuiz: true },
      { title: 'Обратная связь', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    title: 'System Design для Senior',
    description: 'Подготовка к вопросам по системному дизайну для позиции Senior Developer.',
    difficulty: 'Senior',
    language: 'English',
    coverUrl: '/images/courses/sysdis.png',
    tags: ['System Design', 'Architecture', 'Senior'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы системного дизайна', type: 'Theory', hasQuiz: true },
      { title: 'Масштабирование', type: 'Theory', hasQuiz: true },
      { title: 'Практические кейсы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    title: 'JavaScript для Junior Frontend',
    description: 'Всё, что нужно знать Junior Frontend разработчику о JavaScript.',
    difficulty: 'Beginner',
    language: 'JavaScript',
    coverUrl: '/images/courses/js.png',
    tags: ['JavaScript', 'Frontend', 'Web'],
    authorIndex: 1,
    lessons: [
      { title: 'Основы JavaScript', type: 'Theory', hasQuiz: true },
      { title: 'DOM манипуляции', type: 'Theory', hasQuiz: true },
      { title: 'Асинхронный JavaScript', type: 'Coding', hasQuiz: true }
    ]
  }
];

// Функция для заполнения базы данных
async function seedDatabase() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Очистка таблиц...');
    
    // Используем TRUNCATE с CASCADE вместо DELETE для более надежной очистки
    try {
      // Отключаем проверку внешних ключей на время очистки (опционально)
      // await client.query('SET session_replication_role = replica;');
      
      // Удаляем данные из таблиц, очищая их все за один запрос с учетом зависимостей
      await client.query(`
        TRUNCATE TABLE 
          ratings, 
          enrollments, 
          lesson_progress, 
          question_options, 
          questions, 
          lesson_content, 
          lessons, 
          course_tags, 
          course_stats, 
          courses, 
          user_stats, 
          users
        CASCADE;
      `);
      
      // Восстанавливаем проверку внешних ключей (если отключали)
      // await client.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Ошибка при очистке таблиц:', error);
      throw error;
    }
    
    console.log('Создание пользователей...');
    
    // Создаем пользователей
    const createdUserIds = [];
    
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const result = await client.query(
        `INSERT INTO users (email, password, full_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [user.email, hashedPassword, user.fullName]
      );
      
      const userId = result.rows[0].id;
      createdUserIds.push(userId);
      
      await client.query(
        `INSERT INTO user_stats (user_id, active_courses, completed_courses, avg_score) 
         VALUES ($1, $2, $3, $4)`,
        [userId, 0, 0, 0]
      );
    }
    
    console.log('Создание курсов...');
    
    // Создаем курсы
    for (const course of courses) {
      const authorId = createdUserIds[course.authorIndex];
      
      const result = await client.query(
        `INSERT INTO courses 
           (author_id, title, description, difficulty, language, cover_url, estimated_duration, version, is_published) 
         VALUES 
           ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [authorId, course.title, course.description, course.difficulty, course.language, 
         course.coverUrl, course.lessons.length * 2, 1, true]
      );
      
      const courseId = result.rows[0].id;
      
      // Добавляем статистику курса
      await client.query(
        `INSERT INTO course_stats 
           (course_id, enrollments, avg_completion, avg_score) 
         VALUES 
           ($1, $2, $3, $4)`,
        [courseId, Math.floor(Math.random() * 300), Math.floor(Math.random() * 40) + 60, (Math.random() * 1.5) + 3.5]
      );
      
      // Добавляем теги
      for (const tag of course.tags) {
        await client.query(
          `INSERT INTO course_tags (course_id, tag) VALUES ($1, $2)`,
          [courseId, tag]
        );
      }
      
      // Добавляем уроки
      for (let i = 0; i < course.lessons.length; i++) {
        const lesson = course.lessons[i];
        
        const lessonResult = await client.query(
          `INSERT INTO lessons 
             (course_id, title, type, sort_order) 
           VALUES 
             ($1, $2, $3, $4) 
           RETURNING id`,
          [courseId, lesson.title, lesson.type, i]
        );
        
        const lessonId = lessonResult.rows[0].id;
        
        // Добавляем содержимое урока
        await client.query(
          `INSERT INTO lesson_content 
             (lesson_id, content, video_url) 
           VALUES 
             ($1, $2, $3)`,
          [lessonId, `# ${lesson.title}\n\nЭто содержимое урока ${lesson.title} курса ${course.title}.`, null]
        );
        
        // Добавляем вопросы для квиза
        if (lesson.hasQuiz) {
          for (let j = 0; j < 3; j++) {
            const questionResult = await client.query(
              `INSERT INTO questions 
                 (lesson_id, text, type, sort_order) 
               VALUES 
                 ($1, $2, $3, $4) 
               RETURNING id`,
              [lessonId, `Вопрос ${j+1} для урока ${lesson.title}`, j === 0 ? 'choice' : (j === 1 ? 'shortText' : 'longText'), j]
            );
            
            const questionId = questionResult.rows[0].id;
            
            // Добавляем варианты ответов для вопросов с выбором
            if (j === 0) {
              for (let k = 0; k < 4; k++) {
                await client.query(
                  `INSERT INTO question_options 
                     (question_id, label, is_correct, sort_order) 
                   VALUES 
                     ($1, $2, $3, $4)`,
                  [questionId, `Вариант ${k+1}`, k === 0, k]
                );
              }
            }
          }
        }
      }
      
      console.log(`Создан курс: ${course.title}`);
    }
    
    console.log('Создание записей на курсы...');
    
    // Записываем обычного пользователя на несколько курсов
    const userId = createdUserIds[2]; // ID обычного пользователя
    
    // Получаем курсы
    const coursesResult = await client.query('SELECT id FROM courses LIMIT 3');
    const courseIds = coursesResult.rows.map(row => row.id);
    
    // Записываем на курсы
    for (let i = 0; i < courseIds.length; i++) {
      const courseId = courseIds[i];
      
      await client.query(
        `INSERT INTO enrollments 
           (user_id, course_id, status, progress, started_at) 
         VALUES 
           ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, courseId, i === 0 ? 'completed' : 'inProgress', i === 0 ? 100 : Math.floor(Math.random() * 70)]
      );
      
      // Обновляем статистику
      await client.query(
        `UPDATE user_stats 
         SET active_courses = active_courses + CASE WHEN $1 = 'inProgress' THEN 1 ELSE 0 END,
             completed_courses = completed_courses + CASE WHEN $1 = 'completed' THEN 1 ELSE 0 END 
         WHERE user_id = $2`,
        [i === 0 ? 'completed' : 'inProgress', userId]
      );
      
      await client.query(
        `UPDATE course_stats 
         SET enrollments = enrollments + 1 
         WHERE course_id = $1`,
        [courseId]
      );
      
      // Оцениваем законченный курс
      if (i === 0) {
        await client.query(
          `INSERT INTO ratings 
             (user_id, course_id, value, created_at) 
           VALUES 
             ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [userId, courseId, 5]
        );
        
        // Обновляем среднюю оценку курса
        await client.query(
          `UPDATE course_stats 
           SET avg_score = 
             (SELECT AVG(value)::numeric(5,2) FROM ratings WHERE course_id = $1) 
           WHERE course_id = $1`,
          [courseId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    console.log('База данных успешно заполнена тестовыми данными!');
    console.log('\nДанные для входа:');
    for (const user of users) {
      console.log(`- ${user.email}: ${user.password}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при заполнении базы данных:', error);
  } finally {
    client.release();
    // Закрываем пул соединений
    db.pool.end();
  }
}

// Запускаем заполнение
seedDatabase();

// ==== File: backend/server.js ====
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fileUpload = require('express-fileupload'); // Добавляем модуль для загрузки файлов
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');

// Create Express app
const app = express();

// Middleware
app.use(cors());

// Настройка helmet с учетом необходимости загрузки изображений
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  })
);

app.use(morgan('dev'));
app.use(express.json());

// Middleware для загрузки файлов
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB макс. размер файла
  abortOnLimit: true,
  responseOnLimit: 'Файл слишком большой (макс. 5MB)'
}));

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/courses', courseRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

// ==== File: backend/utils/jwt.js ====
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

/**
 * Verify a JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken
};

// ==== File: frontend/eslint.config.js ====
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)


// ==== File: frontend/postcss.config.js ====
export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  }

// ==== File: frontend/src/App.tsx ====
// ==== File: frontend/src/App.tsx ====
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import { useAuth } from './hooks/useAuth';

const AboutPage = () => <div className="py-12 text-center">Страница "О нас" в разработке</div>;
const CreateCoursePage = () => <div className="py-12 text-center">Страница создания курса в разработке</div>;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!isAuthenticated) { return <Navigate to="/" replace />; }
  return <>{children}</>;
};

// Fixed NotFoundPage definition
const NotFoundPage = () => (
  <div className="py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <a href="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</a>
  </div>
); // Ensure this is correctly defined and closed

export default function App() {
  const { isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route 
            path="/profile" 
            element={ <ProtectedRoute> <ProfilePage /> </ProtectedRoute> } 
          />
          <Route
            path="/profile/edit"
            element={ <ProtectedRoute> <EditProfilePage /> </ProtectedRoute> }
          />
          <Route 
            path="/create-course" 
            element={ <ProtectedRoute> <CreateCoursePage /> </ProtectedRoute> } 
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

// ==== File: frontend/src/api/authApi.ts ====
import client from './client';
import type { User } from '../types/User';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

interface AuthTokenResponse {
  accessToken: string;
}

export async function login(data: LoginData): Promise<User> {
  try {
    // Get token
    const response = await client.post<AuthTokenResponse>('/auth/login', data);
    const { accessToken } = response.data;
    localStorage.setItem('token', accessToken);
    
    // Get user information
    const userResponse = await client.get<User>('/users/me');
    localStorage.setItem('user', JSON.stringify(userResponse.data));
    
    return userResponse.data;
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
}

export async function register(data: RegisterData): Promise<User> {
  try {
    // Register user
    await client.post('/auth/register', {
      email: data.email,
      password: data.password,
      fullName: data.fullName
    });

    // Login after registration
    const loginResponse = await client.post<AuthTokenResponse>('/auth/login', {
      email: data.email,
      password: data.password
    });
    
    const { accessToken } = loginResponse.data;
    localStorage.setItem('token', accessToken);

    // Update profile with full name
    const userResponse = await client.patch<User>('/users/me', {
      fullName: data.fullName
    });
    
    localStorage.setItem('user', JSON.stringify(userResponse.data));
    return userResponse.data;
  } catch (error) {
    console.error('Register API error:', error);
    throw error;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Force refresh to reset application state
  window.location.href = '/';
}

// ==== File: frontend/src/api/client.ts ====
// ===== ./src/api/client.ts =====
import axios from 'axios';

// Create API client with correct base URL
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/v1', // Make sure this matches your backend
  headers: { 'Content-Type': 'application/json' },
});

// Add request interceptor to include auth token
client.interceptors.request.use(config => {
  // Get token from localStorage
  const token = localStorage.getItem('token');

  if (token) {
    // Set Authorization header for every request if token exists
    config.headers['Authorization'] = `Bearer ${token}`;
    console.log('Request with token:', config.url);
  } else {
    console.log('Request without token:', config.url);
  }

  return config;
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor for error handling
client.interceptors.response.use(
  response => {
    console.log('Response success:', response.config.url);
    return response;
  },
  error => {
    console.error('Response error:', error.config?.url, error.response?.status, error.message);

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Only redirect if it's not a login attempt that failed
      // and also not a /users/me call right after a failed login without token
      const requestUrl = error.config.url || '';
      if (!requestUrl.endsWith('/auth/login') && !requestUrl.endsWith('/users/me')) {
        console.log('Authentication error (not login/initial me) - clearing credentials');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/'; // Redirect to home page
      } else {
        console.log(`Auth-related request to ${requestUrl} failed with 401. Error will be handled by the caller.`);
        // For login failure or initial /users/me failure, we don't redirect here.
        // The calling component (e.g., AuthModal or useAuth) should handle this.
      }
    }
    
    return Promise.reject(error);
  }
);

export default client;

// ==== File: frontend/src/api/coursesApi.ts ====
import client from './client';
import type { Course } from '../types/Course';
import type { CourseFilters } from '../hooks/useCourses';

// Изменить на false для использования настоящего API
const USE_MOCK_DATA = false; 

interface CourseParams {
  search?: string;
  sort?: 'popularity' | 'difficulty' | 'duration';
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
}

export async function getCourses(params?: CourseParams): Promise<Course[]> {
  if (USE_MOCK_DATA) {
    // Здесь оставим мок-реализацию для возможности разработки без бэкенда
    const { mockCourses } = await import('./mockData');
    
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        let filteredCourses = [...mockCourses];
        
        // Apply filters
        if (params?.search) {
          const searchLower = params.search.toLowerCase();
          filteredCourses = filteredCourses.filter(
            course => 
              course.title.toLowerCase().includes(searchLower) || 
              course.authorName.toLowerCase().includes(searchLower) ||
              course.tags.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        
        if (params?.level) {
          filteredCourses = filteredCourses.filter(
            course => course.difficulty === params.level
          );
        }
        
        if (params?.language) {
          filteredCourses = filteredCourses.filter(
            course => course.language === params.language
          );
        }
        
        // Apply sorting
        if (params?.sort) {
          switch (params.sort) {
            case 'popularity':
              filteredCourses = filteredCourses.sort(
                (a, b) => b.stats.enrollments - a.stats.enrollments
              );
              break;
            case 'difficulty':
              // Sort by difficulty level (Beginner → Middle → Senior)
              const difficultyOrder = { 'Beginner': 1, 'Middle': 2, 'Senior': 3 };
              filteredCourses = filteredCourses.sort(
                (a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
              );
              break;
            case 'duration':
              filteredCourses = filteredCourses.sort(
                (a, b) => b.estimatedDuration - a.estimatedDuration
              );
              break;
          }
        }
        
        resolve(filteredCourses);
      }, 600); // Simulate a short delay
    });
  } else {
    // Real API call
    const apiParams: Record<string, string | string[] | undefined> = {};
    
    // Map frontend params to API params
    if (params?.search) apiParams.search = params.search;
    if (params?.sort) apiParams.sort = params.sort;
    if (params?.level) apiParams.difficulty = params.level; // Изменено на difficulty согласно API
    if (params?.language) apiParams.language = params.language;
    if (params?.tags) apiParams.tags = params.tags;
    if (params?.tags && params.tags.length > 0) {
      apiParams.tags = params.tags.join(','); // Join for backend
    }
    
    const response = await client.get<Course[]>('/courses', { params: apiParams });
    return response.data;
  }
}

export async function getCourseById(id: string): Promise<Course> {
  if (USE_MOCK_DATA) {
    const { mockCourses } = await import('./mockData');
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const course = mockCourses.find(c => c.id === id);
        if (course) {
          resolve(course);
        } else {
          reject(new Error('Course not found'));
        }
      }, 300);
    });
  } else {
    const response = await client.get<Course>(`/courses/${id}`);
    return response.data;
  }
}

export async function enrollCourse(courseId: string) {
  if (USE_MOCK_DATA) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, courseId });
      }, 500);
    });
  } else {
    const response = await client.post(`/courses/${courseId}/enroll`);
    return response.data;
  }
}

export async function rateCourse(courseId: string, value: number) {
  if (USE_MOCK_DATA) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ success: true, courseId, value });
      }, 500);
    });
  } else {
    const response = await client.post(`/courses/${courseId}/rating`, { value });
    return response.data;
  }
}

// ==== File: frontend/src/api/mockData.ts ====
// This file provides mock data for development until the actual API is connected
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

// ==== File: frontend/src/api/userApi.ts ====
import client from './client';
import type { User } from '../types/User';
import type { Course } from '../types/Course'; // Import Course type

interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
}

// Interface for Enrollment data returned by the new endpoint
export interface EnrollmentWithCourse {
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null; // User's rating for completed course
    course: Course; // Full course details
}


/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<User> {
  console.log('Getting current user data');
  try {
    const response = await client.get<User>('/users/me');
    console.log('User data received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  console.log('Updating profile with data:', data);
  try {
    const response = await client.patch<User>('/users/me', data);
    console.log('Profile updated:', response.data);
    
    // Update localStorage
    localStorage.setItem('user', JSON.stringify(response.data));
    
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(formData: FormData): Promise<{ avatarUrl: string }> {
  console.log('Uploading avatar');
  try {
    const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    console.log('Avatar uploaded, new URL:', response.data.avatarUrl);
    return response.data;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

/**
 * Get user's enrollments by status
 */
export async function getMyEnrollments(status: 'inProgress' | 'completed'): Promise<EnrollmentWithCourse[]> {
  console.log(`Getting enrollments with status: ${status}`);
  try {
    const response = await client.get<EnrollmentWithCourse[]>('/users/me/enrollments', {
      params: { status }
    });
    console.log(`Enrollments received for status ${status}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error getting enrollments for status ${status}:`, error);
    throw error;
  }
}

/**
 * Get courses created by the user
 */
export async function getMyCreatedCourses(): Promise<Course[]> {
  console.log('Getting created courses');
  try {
    const response = await client.get<Course[]>('/users/me/courses');
    console.log('Created courses received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting created courses:', error);
    throw error;
  }
}

// ==== File: frontend/src/components/AuthModal.tsx ====
// ===== ./frontend/src/components/AuthModal.tsx =====
import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom'; // Можно использовать вместо window.location
import { useAuth } from '../hooks/useAuth'; // Убедись, что путь верный

// SVG иконки для удобства (можно вынести в отдельные файлы)
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
);

const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
);


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // const navigate = useNavigate(); // Альтернатива window.location.reload

  // Состояние для видимости пароля
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Определяем, активна ли кнопка отправки
  const isSubmitDisabled = isLoading || (isLoginMode
      ? (!email || !password) // Условие для входа
      : (!fullName || !email || !password || !confirmPassword || password !== confirmPassword || password.length < 8) // Условие для регистрации
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return; // Не отправлять, если кнопка неактивна

    setIsLoading(true);
    setError('');

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        // Проверка паролей уже в isSubmitDisabled, но можно оставить для надежности
        if (password !== confirmPassword) throw new Error('Пароли не совпадают');
        if (password.length < 8) throw new Error('Пароль должен быть не менее 8 символов');
        await register(email, password, fullName);
      }

      onLoginSuccess();
      onClose();

      // Перезагрузка для обновления состояния (можно заменить на navigate('/') если используется React Router)
      window.location.reload(); // Или window.location.href = '/';
    } catch (err) {
        // Форматируем сообщение об ошибке
        if (err instanceof Error) {
            if ((err as any).response?.data?.code === 'INVALID_CREDENTIALS') {
                setError('Неверный email или пароль');
            } else if ((err as any).response?.data?.code === 'EMAIL_EXISTS') {
                setError('Пользователь с таким email уже существует');
            } else {
                setError(err.message);
            }
        } else {
           setError('Произошла неизвестная ошибка');
        }
      console.error("Auth Error:", err); // Логируем полную ошибку
    } finally {
      setIsLoading(false);
    }
  };

  // Сброс полей при смене режима
  const handleModeSwitch = (switchToLogin: boolean) => {
    setIsLoginMode(switchToLogin);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (!isOpen) return null;

  return (
    // Оверлей
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
      {/* Карточка модального окна */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">

        {/* Опциональный лоадер */}
        {isLoading && (
             <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
             </div>
        )}

        {/* Контент */}
        <div className="p-8">
          {/* Хедер с логотипом и кнопкой назад (для регистрации) */}
          <div className="relative flex justify-center items-center mb-6 h-8">
            {!isLoginMode && (
              <button
                type="button"
                onClick={() => handleModeSwitch(true)} // Переключиться на вход
                className="absolute left-0 text-gray-500 hover:text-gray-800"
                aria-label="Назад ко входу"
              >
                <BackArrowIcon />
              </button>
            )}
            <span className="text-2xl font-bold text-orange-600">AI-Hunt</span>
             {/* Кнопка закрытия (если нужна именно внутри, а не только по клику на оверлей) */}
            <button
                onClick={onClose}
                className="absolute right-0 text-gray-400 hover:text-gray-600"
                aria-label="Закрыть окно"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
          </div>

          {/* Заголовок */}
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
            {isLoginMode ? 'Вход в профиль' : 'Регистрация'}
          </h2>

          {/* Сообщение об ошибке */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Поле ФИО (только для регистрации) */}
            {!isLoginMode && (
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm"
                  required={!isLoginMode}
                  placeholder="ФИО"
                  aria-label="ФИО"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Поле Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm"
                required
                placeholder="Электронная почта"
                aria-label="Электронная почта"
                disabled={isLoading}
              />
            </div>

            {/* Поле Пароль */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm pr-10" // Добавляем padding справа для иконки
                required
                minLength={8}
                placeholder="Пароль"
                aria-label="Пароль"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>

             {/* Ссылка "Не помню пароль" (только для входа) */}
             {isLoginMode && (
                 <div className="text-right">
                    <button type="button" className="text-sm text-gray-500 hover:text-orange-600 hover:underline">
                        Не помню пароль
                    </button>
                 </div>
             )}


            {/* Поле Подтверждение пароля (только для регистрации) */}
            {!isLoginMode && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 text-sm pr-10"
                  required={!isLoginMode}
                  minLength={8}
                  placeholder="Подтвердите пароль"
                  aria-label="Подтверждение пароля"
                  disabled={isLoading}
                />
                 <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                 >
                    {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                 </button>
              </div>
            )}

            {/* Кнопка Отправки */}
            <button
              type="submit"
              disabled={isSubmitDisabled} // Используем вычисленное состояние
              className={`w-full text-white py-3 px-4 rounded-lg transition-colors duration-200 font-semibold text-sm ${
                  isSubmitDisabled
                  ? 'bg-gray-300 cursor-not-allowed' // Стиль неактивной кнопки
                  : 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500' // Стиль активной кнопки
              }`}
            >
              {isLoading ? 'Подождите...' : (isLoginMode ? 'Войти' : 'Зарегистрироваться')}
            </button>

            {/* Кнопка переключения режима / создания профиля */}
            {isLoginMode ? (
                 <button
                    type="button"
                    onClick={() => handleModeSwitch(false)} // Переключиться на регистрацию
                    disabled={isLoading}
                    className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-semibold text-sm"
                >
                    Создать профиль
                </button>
            ) : (
                 <div className="text-center text-sm">
                    <span className="text-gray-500">Уже есть аккаунт? </span>
                    <button
                        type="button"
                        onClick={() => handleModeSwitch(true)} // Переключиться на вход
                        disabled={isLoading}
                        className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                    >
                         Войти
                    </button>
                 </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

// ==== File: frontend/src/components/CourseCard.tsx ====
import React from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '../types/Course';
import { useAuth } from '../hooks/useAuth';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const { isAuthenticated } = useAuth();

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'Для начинающих';
      case 'Middle':
        return 'Средний уровень';
      case 'Senior':
        return 'Продвинутый уровень';
      default:
        return difficulty;
    }
  };

  return (
    <div className="h-full">
      <Link to={isAuthenticated ? `/courses/${course.id}` : '#'} className="block h-full">
        <div className="card h-48 sm:h-56 bg-gray-300 relative overflow-hidden rounded-2xl">
          {/* Фон */}
          <img
            src={course.coverUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          {/* Оверлей */}
          <div className="absolute inset-0 bg-gray-500 opacity-30 rounded-2xl" />
          {/* Контент */}
          <div className="absolute inset-0 z-10 p-4 flex flex-col justify-between">
            {/* Автор и заголовок */}
            <div>
              <div className="mb-1 text-xs text-white">{course.authorName}</div>
              <h3 className="text-lg font-light leading-tight line-clamp-2 text-white">
                {course.title}
              </h3>
            </div>
            {/* Статистика */}
            <div className="flex items-center space-x-6 text-white">
              {/* Рейтинг */}
              <div className="flex items-center">
                <span className="text-yellow-400 mr-1 text-xs">★</span>
                <span className="text-sm">{course.stats.avgScore.toFixed(1)}</span>
              </div>
              {/* Длительность */}
              <div className="flex items-center">
                <svg className="w-3.5 h-3.5 text-green-400 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-sm">{course.estimatedDuration} ч</span>
              </div>
              {/* Уровень */}
              <div className="flex items-center">
                <svg className="w-3.5 h-3.5 text-blue-400 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-sm">{getDifficultyLabel(course.difficulty)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CourseCard;

// ==== File: frontend/src/components/CourseList.tsx ====
import React from 'react';
import type { Course } from '../types/Course';
import CourseCard from './CourseCard';

interface CourseListProps {
  courses: Course[];
  loading?: boolean;
  error?: Error | null;
}

const CourseList: React.FC<CourseListProps> = ({ 
  courses, 
  loading = false, 
  error = null 
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-2">Произошла ошибка при загрузке курсов</div>
        <div className="text-gray-500 text-sm">{error.message}</div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-2">Курсы не найдены</div>
        <div className="text-gray-400 text-sm">Попробуйте изменить параметры поиска</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
};

export default CourseList;

// ==== File: frontend/src/components/Filters.tsx ====
import React from 'react';

interface FiltersProps {
  onChange: (filters: { sort?: 'popularity' | 'difficulty' | 'duration'; level?: string; language?: string }) => void;
}

const Filters: React.FC<FiltersProps> = ({ onChange }) => {
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ sort: e.target.value as 'popularity' | 'difficulty' | 'duration' });
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ level: e.target.value });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ language: e.target.value });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Сортировка */}
      <div className="relative">
        <select
          onChange={handleSortChange}
          defaultValue="popularity"
          className="select-filter select-primary rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="popularity">Сначала: Популярное</option>
          <option value="difficulty">Сначала: Сложность</option>
          <option value="duration">Сначала: Длительность</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Уровень */}
      <div className="relative">
        <select
          onChange={handleLevelChange}
          defaultValue=""
          className="select-filter select-dark rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="">Уровень</option>
          <option value="Beginner">Beginner</option>
          <option value="Middle">Middle</option>
          <option value="Senior">Senior</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Язык */}
      <div className="relative">
        <select
          onChange={handleLanguageChange}
          defaultValue=""
          className="select-filter select-dark rounded-md appearance-none pr-6 pl-3 py-1.5 text-sm"
        >
          <option value="">Язык</option>
          <option value="JavaScript">JavaScript</option>
          <option value="Python">Python</option>
          <option value="SQL">SQL</option>
          <option value="Java">Java</option>
          <option value="C++">C++</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-white">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Filters;


// ==== File: frontend/src/components/HeroSection.tsx ====
// ===== ./src/components/HeroSection.tsx =====
import React from 'react';

interface HeroSectionProps {
  onTagClick: (tag: string) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onTagClick }) => {
  const tags = [
    '#Популярное', '#Python', '#ИскусственныйИнтеллект', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#ПостроениеКарьерногоПути',
    '#СПрактикой', '#Docker', '#Креативность', '#БезОпыта'
  ];

  const handleInternalTagClick = (fullTag: string) => {
    // Remove '#' and pass the clean tag
    const cleanTag = fullTag.startsWith('#') ? fullTag.substring(1) : fullTag;
    onTagClick(cleanTag);
  };

  return (
    <div className="bg-orange text-white flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12 sm:py-16"> {/* Adjusted min-h and padding */}
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
          Подготовься к IT-собеседованию
        </h1>
        <p className="text-lg sm:text-xl text-orange-100 mb-10">
          Получай мгновенную обратную связь на свои ответы и код.
          <br />
          Готовься эффективнее с AI-hunt.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => handleInternalTagClick(tag)}
              className="bg-gray-900 bg-opacity-70 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full cursor-pointer hover:bg-opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-opacity-50"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

// ==== File: frontend/src/components/Layout.tsx ====
import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col"> {/* Removed bg-gray-50 */}
      <Navbar />
      {/* pt-16 is h-16 for navbar height */}
      <main className="flex-grow w-full pt-16"> 
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} AI-Hunt. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

// ==== File: frontend/src/components/Navbar.tsx ====
// ===== ./src/components/Navbar.tsx =====
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import AuthModal from './AuthModal';
import { useAuth } from '../hooks/useAuth';

const Navbar: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      if (isHomePage) {
        setIsScrolled(window.scrollY > 50); // Change style after 50px scroll
      } else {
        setIsScrolled(true); // Other pages always have the "scrolled" navbar style
      }
    };

    // Set initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const navClasses = isHomePage && !isScrolled
    ? 'bg-orange text-white' // Use default orange from config
    : 'bg-white text-gray-900 shadow-sm';

  const logoColor = isHomePage && !isScrolled ? 'text-white' : 'text-gray-900';

  const linkBaseClasses = 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200';
  const getLinkClasses = (isActive: boolean) => {
    if (isHomePage && !isScrolled) {
      return `${linkBaseClasses} ${isActive ? 'border-white font-semibold' : 'border-transparent text-orange-50 hover:text-white'}`;
    }
    return `${linkBaseClasses} ${isActive ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
  };

  const authButtonClasses = `flex items-center transition-colors focus:outline-none text-sm font-medium ${
    isHomePage && !isScrolled
      ? 'text-orange-50 hover:text-white'
      : 'text-gray-700 hover:text-orange-500'
  }`;

  const mobileMenuIconColor = isHomePage && !isScrolled ? 'text-white hover:bg-orange-700' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100';
  const mobilePanelClasses = isHomePage && !isScrolled ? 'bg-orange text-white' : 'bg-white text-gray-900'; // Use default orange

  const getMobileLinkClasses = (isActive: boolean) => {
    if (isHomePage && !isScrolled) {
      return `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${isActive ? 'bg-orange-700 border-white text-white' : 'border-transparent text-orange-50 hover:bg-orange-700 hover:text-white'}`;
    }
    return `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${isActive ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'}`;
  };


  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navClasses}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <NavLink to="/" className="flex-shrink-0 flex items-center">
                <span className={`text-2xl font-bold ${logoColor}`}>AI-Hunt</span>
              </NavLink>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                <NavLink to="/about" className={({ isActive }) => getLinkClasses(isActive)}>
                  О нас
                </NavLink>
                <NavLink to="/" className={({ isActive }) => getLinkClasses(isActive)}>
                  Курсы
                </NavLink>
                {user && (
                  <NavLink to="/create-course" className={({ isActive }) => getLinkClasses(isActive)}>
                    Создать курс
                  </NavLink>
                )}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className={authButtonClasses}>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName || 'Profile'}
                        className="w-8 h-8 rounded-full object-cover mr-2"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${isHomePage && !isScrolled ? 'bg-orange-500' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="font-medium">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                    Профиль
                  </Link>
                  <button onClick={logout} className={authButtonClasses}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Выйти
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAuthModalOpen(true)} className={authButtonClasses}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1 ${isHomePage && !isScrolled ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.485 0 4.807.66 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Войти
                </button>
              )}
            </div>
            <div className="flex items-center sm:hidden">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`inline-flex items-center justify-center p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 ${mobileMenuIconColor}`}
                aria-expanded="false"
              >
                <span className="sr-only">{isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}</span>
                <svg className="block h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" strokeWidth="2">
                  {isMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className={`sm:hidden ${mobilePanelClasses}`}>
            <div className="pt-2 pb-3 space-y-1">
              <NavLink to="/about" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                О нас
              </NavLink>
              <NavLink to="/" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                Курсы
              </NavLink>
              {user && (
                <NavLink to="/create-course" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                  Создать курс
                </NavLink>
              )}
            </div>
            <div className={`pt-4 pb-3 border-t ${isHomePage && !isScrolled ? 'border-orange-500' : 'border-gray-200'}`}>
              {user ? (
                <div>
                  <div className="flex items-center px-4">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName || 'Profile'} className="h-10 w-10 rounded-full object-cover"/>
                    ) : (
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isHomePage && !isScrolled ? 'bg-orange-500' : 'bg-gray-200 text-gray-600'}`}>
                        <span className="font-medium">{user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}</span>
                      </div>
                    )}
                    <div className="ml-3">
                      <div className={`text-base font-medium ${isHomePage && !isScrolled ? 'text-white' : 'text-gray-800'}`}>{user.fullName}</div>
                      <div className={`text-sm font-medium ${isHomePage && !isScrolled ? 'text-orange-100' : 'text-gray-500'}`}>{user.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link
                      to="/profile"
                      className={`block px-4 py-2 text-base font-medium ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Профиль
                    </Link>
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className={`block w-full text-left px-4 py-2 text-base font-medium ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                    >
                      Выйти
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4">
                  <button
                    onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                    className={`block text-base font-medium w-full text-left px-4 py-2 ${isHomePage && !isScrolled ? 'text-orange-50 hover:bg-orange-700 hover:text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                  >
                    Войти
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};

export default Navbar;

// ==== File: frontend/src/components/SearchBar.tsx ====
// frontend/src/components/SearchBar.tsx
import React from 'react';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onSearch: () => void; // Changed: onSearch will now be called without arguments
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Поиск',
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(); // Call onSearch without query, HomePage will use its own state
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value); // Update parent's state
  };

  return (
    <div className="relative flex-1">
      <form onSubmit={handleSubmit} className="flex">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={value} // Controlled by parent
          onChange={handleInputChange} // Notify parent of change
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
        />
      </form>
    </div>
  );
};

export default SearchBar;

// ==== File: frontend/src/components/profile/ActiveCourseCard.tsx ====
// ===== ./src/components/profile/ActiveCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '@/api/userApi'; // Убедись, что путь верный

interface ActiveCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const ActiveCourseCard: React.FC<ActiveCourseCardProps> = ({ enrollment }) => {
  const { course, progress } = enrollment;
  const totalLessons = course.lessons?.length || 1;
  // Рассчитываем количество завершенных уроков на основе прогресса (0-100)
  // Округляем до ближайшего целого
  const completedLessons = Math.round((progress / 100) * totalLessons);

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height for title */}

         {/* Progress Bar */}
         <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Прогресс</span>
                <span>{completedLessons}/{totalLessons}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"> {/* Added overflow-hidden */}
                <div
                    className="bg-orange-500 h-2 rounded-full transition-width duration-300 ease-in-out" // Added transition
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                ></div>
            </div>
        </div>
      </div>
      <Link
        to={`/courses/${course.id}`} // Ссылка на страницу курса
        className="block w-full mt-auto px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors font-medium text-sm" // Added focus styles
      >
        Продолжить
      </Link>
    </div>
  );
};

export default ActiveCourseCard;

// ==== File: frontend/src/components/profile/CompletedCourseCard.tsx ====
// ===== ./src/components/profile/CompletedCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { EnrollmentWithCourse } from '@/api/userApi'; // Убедись, что путь верный

interface CompletedCourseCardProps {
  enrollment: EnrollmentWithCourse;
}

const CompletedCourseCard: React.FC<CompletedCourseCardProps> = ({ enrollment }) => {
  const { course, userRating } = enrollment;
  // Текст результата. Можно добавить больше логики, если API дает оценку
  const resultText = `Результат: ${userRating ? `${userRating}/5` : 'Завершено'}`;

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
        <div>
            <p className="text-xs text-gray-500 mb-1">{course.authorName}</p>
             <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height */}
            {/* Отображаем результат/оценку */}
            <p className="text-sm font-medium text-green-600">{resultText}</p>
        </div>
        {/* Можно добавить кнопку "Повторить" или "Сертификат" */}
        <Link
            to={`/courses/${course.id}`} // Ссылка на страницу курса для просмотра
            className="block w-full mt-auto px-4 py-2 bg-gray-200 text-gray-700 text-center rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors font-medium text-sm" // Secondary button style
        >
            Посмотреть
        </Link>
    </div>
  );
};

export default CompletedCourseCard;

// ==== File: frontend/src/components/profile/CreatedCourseCard.tsx ====
// ===== ./src/components/profile/CreatedCourseCard.tsx =====
import React from 'react';
import { Link } from 'react-router-dom';
import { Course } from '@/types/Course'; // Убедись, что путь верный

interface CreatedCourseCardProps {
  course: Course;
}

const CreatedCourseCard: React.FC<CreatedCourseCardProps> = ({ course }) => {
  const statusText = course.isPublished ? 'Опубликован' : 'Черновик';
  const statusColor = course.isPublished ? 'text-green-600 bg-green-100' : 'text-yellow-700 bg-yellow-100';

  return (
    // Применяем стиль дизайна
    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3 line-clamp-2 h-14">{course.title}</h3> {/* Fixed height */}
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: <span className="font-medium text-gray-800">{course.stats?.enrollments ?? 0}</span></p>
            <p>Статус: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && <p>Версия: <span className="font-medium text-gray-800">{course.version}</span></p>}
        </div>
      </div>
       <div className="flex flex-col sm:flex-row gap-2 mt-auto"> {/* Changed to mt-auto */}
           <Link
                to={`/courses/${course.id}/edit`} // Ссылка на редактор курса
                className="flex-1 px-4 py-2 bg-orange-600 text-white text-center rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors font-medium text-sm"
            >
                Редактировать
            </Link>
            <Link
                to={`/courses/${course.id}/stats`} // Ссылка на статистику курса
                className="flex-1 px-4 py-2 bg-gray-800 text-white text-center rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition-colors font-medium text-sm"
            >
                Статистика
            </Link>
       </div>
    </div>
  );
};

export default CreatedCourseCard;

// ==== File: frontend/src/hooks/useAuth.ts ====
import { useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/authApi';
import type { User } from '../types/User';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data', e);
        localStorage.removeItem('user'); // Clear invalid data
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      // Call API login function
      const response = await apiLogin({ email, password });
      // Make sure user data is stored in localStorage
      if (response) {
        setUser(response);
        localStorage.setItem('user', JSON.stringify(response));
      }
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<User> => {
    try {
      // Call API register function
      const userData = await apiRegister({ email, password, fullName });
      // Make sure user data is stored in localStorage
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
      return userData;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  // Function to update user state without API request
  const updateUserState = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    updateUserState,
    isAuthenticated: !!user
  };
}

// ==== File: frontend/src/hooks/useCourses.ts ====
// frontend/src/hooks/useCourses.ts
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

// ==== File: frontend/src/index.tsx ====
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(<App />);


// ==== File: frontend/src/main.tsx ====
import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// ==== File: frontend/src/pages/CatalogPage.tsx ====
import React, { useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import Filters from '../components/Filters';
import CourseList from '../components/CourseList';
import { useCourses } from '../hooks/useCourses';

const CatalogPage: React.FC = () => {
  const { courses, loading, error, fetchCourses } = useCourses();

  useEffect(() => {
    document.title = 'Каталог курсов - AI-Hunt';
  }, []);

  const handleSearch = (query: string) => {
    fetchCourses({ search: query });
  };

  const handleFilterChange = (filters: { sort?: string; level?: string; language?: string }) => {
    fetchCourses(filters);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Каталог курсов</h1>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <SearchBar onSearch={handleSearch} placeholder="Поиск курсов..." />
        <Filters onChange={handleFilterChange} />
      </div>

      <CourseList 
        courses={courses} 
        loading={loading} 
        error={error} 
      />
    </div>
  );
};

export default CatalogPage;

// ==== File: frontend/src/pages/EditProfilePage.tsx ====
// ===== ./src/pages/EditProfilePage.tsx =====
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar, getCurrentUser } from '../api/userApi';
import type { User } from '../types/User';

const EditProfilePage: React.FC = () => {
  const { user: authUser, updateUserState, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isFetching, setIsFetching] = useState(true); // For fetching current user data

  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Редактирование профиля - AI-Hunt';
  }, []);

  // Fetch current user data on mount to prefill the form
  useEffect(() => {
    if (authUser && !currentUserData) { // Only fetch if authUser exists and we haven't fetched yet
      setIsFetching(true);
      getCurrentUser()
        .then(data => {
          setCurrentUserData(data);
          setFullName(data.fullName || '');
          setAvatarPreview(data.avatarUrl || '/images/default-avatar.png');
        })
        .catch(err => {
          setProfileMessage({ text: 'Не удалось загрузить данные профиля.', type: 'error' });
        })
        .finally(() => setIsFetching(false));
    } else if (!authUser && !isAuthLoading) { // If user is not authenticated (e.g. direct navigation)
        setIsFetching(false); // Stop fetching
        navigate('/profile'); // Or to login page
    }
  }, [authUser, currentUserData, isAuthLoading, navigate]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error' }); return; }
      if (file.size > 5 * 1024 * 1024) { setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error' }); return; }
      setProfileMessage(null);
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setAvatarPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserData) return; // Should not happen if fetching is done

    setIsUpdatingProfile(true);
    setProfileMessage(null);

    try {
      let dataToUpdate: { fullName?: string; avatarUrl?: string } = {};

      if (fullName.trim() !== (currentUserData.fullName || '').trim() && fullName.trim() !== '') {
        dataToUpdate.fullName = fullName.trim();
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarResponse = await uploadAvatar(formData);
        dataToUpdate.avatarUrl = avatarResponse.avatarUrl;
        setAvatarFile(null);
      }

      if (Object.keys(dataToUpdate).length > 0) {
        const updatedUserFromApi = await updateProfile(dataToUpdate);
        updateUserState(updatedUserFromApi); // Update global auth state
        setCurrentUserData(updatedUserFromApi); // Update local state for this page
        setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
        // Optionally navigate back after a short delay
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        setProfileMessage({ text: 'Нет изменений для сохранения.', type: 'success' }); // Or 'info' type
         setTimeout(() => navigate('/profile'), 1500);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setProfileMessage({ text: `Ошибка обновления: ${errorMsg}`, type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile'); // Navigate back to the main profile view
  };

  if (isAuthLoading || isFetching) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }

  if (!authUser || !currentUserData) { // Should be caught by ProtectedRoute, but check again
    // This case should ideally not be reached if ProtectedRoute works correctly.
    // Or if initial fetch failed and currentUserData is still null.
    return <div className="text-center py-12 text-lg">Не удалось загрузить профиль для редактирования. <Link to="/profile" className="text-orange-500">Вернуться в профиль</Link>.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
        Редактирование профиля
      </h1>

      {profileMessage && (
        <div className={`p-3 mb-6 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {profileMessage.text}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-lg border border-gray-200">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36">
            <img
              src={avatarPreview || '/images/default-avatar.png'}
              alt="Аватар"
              className="w-full h-full object-cover rounded-full border-2 border-gray-300 shadow-sm"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full p-2 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow"
              title="Изменить аватар"
              disabled={isUpdatingProfile}
            >
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={isUpdatingProfile}
              />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Profile Fields Section */}
        <div className="space-y-6 mb-8">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">
              ФИО
            </label>
            <input
              id="editFullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isUpdatingProfile}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white text-sm sm:text-base"
            />
          </div>
          <div>
            <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Электронная почта
            </label>
            <input
              id="editEmail"
              type="email"
              value={currentUserData.email} // Display from currentUserData
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUpdatingProfile}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isUpdatingProfile}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 disabled:opacity-60"
          >
            {isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;

// ==== File: frontend/src/pages/HomePage.tsx ====
// frontend/src/pages/HomePage.tsx
import React, { useEffect, useRef, useState } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import CourseList from '../components/CourseList';
import { useCourses, CourseFilters } from '../hooks/useCourses';

const initialCourseFilters: CourseFilters = {
  sort: 'popularity',
  tags: [],
  search: '',
  level: undefined,
  language: undefined,
};

const HomePage: React.FC = () => {
  const { courses, loading, error, filters: currentActiveFilters, applyFilters } = useCourses();
  const catalogRef = useRef<HTMLDivElement>(null);
  // State for the search bar input, controlled by HomePage
  const [searchTerm, setSearchTerm] = useState(currentActiveFilters.search || '');

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
  }, []);

  // Sync searchTerm with external changes to currentActiveFilters.search
  // (e.g., if filters are reset or tag click clears search)
  useEffect(() => {
    if (currentActiveFilters.search !== searchTerm) {
      setSearchTerm(currentActiveFilters.search || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentActiveFilters.search]);


  const handleSearch = () => {
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity',
      search: searchTerm, // Use the local searchTerm state
      tags: [],
      level: undefined,
      language: undefined,
    });
  };

  const handleTagClick = (tag: string) => {
    setSearchTerm(''); // Clear search term when a tag is clicked
    applyFilters({
      sort: currentActiveFilters.sort || 'popularity',
      search: '',
      tags: [tag],
      level: undefined,
      language: undefined,
    });
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSearchTerm(''); // Clear local search term state
    applyFilters(initialCourseFilters);
  };

  return (
    <div>
      <HeroSection onTagClick={handleTagClick} />
      <div id="catalog" ref={catalogRef} className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          <div className="flex items-center gap-x-3 mb-8">
            <div className="flex-grow">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm} // Controlled component: update searchTerm
                onSearch={handleSearch} // Trigger search using HomePage's searchTerm
                placeholder="Поиск по названию, автору или тегам..."
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              title="Сбросить все фильтры и поиск"
            >
              Сбросить
            </button>
          </div>
          {/* Wrapper for CourseList to prevent layout jumps */}
          <div className="min-h-[300px]"> {/* Adjust min-height as needed */}
            <CourseList
              courses={courses}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

// ==== File: frontend/src/pages/ProfilePage.tsx ====
// ==== File: frontend/src/pages/ProfilePage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { useAuth } from '../hooks/useAuth';
import {
    getCurrentUser,
    getMyEnrollments,
    getMyCreatedCourses,
    EnrollmentWithCourse
} from '../api/userApi';
import type { User } from '../types/User';
import type { Course } from '../types/Course';
import ActiveCourseCard from '@/components/profile/ActiveCourseCard';
import CompletedCourseCard from '@/components/profile/CompletedCourseCard';
import CreatedCourseCard from '@/components/profile/CreatedCourseCard';

enum ProfileTab {
  ActiveCourses = 'active',
  CompletedCourses = 'completed',
  CreatedCourses = 'created'
}

const ProfilePage: React.FC = () => {
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [isFetchingInitialProfile, setIsFetchingInitialProfile] = useState<boolean>(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.ActiveCourses);
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [completedEnrollments, setCompletedEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    document.title = authUser ? `${authUser.fullName || 'Профиль'} - AI-Hunt` : 'Профиль - AI-Hunt';
  }, [authUser]);

  // --- Effect 1: Fetch initial profile data ---
  useEffect(() => {
    if (!isAuthLoading && authUser && !userData && !isFetchingInitialProfile && !initialLoadError) {
      setIsFetchingInitialProfile(true);
      setInitialLoadError(null);
      getCurrentUser()
        .then(latestUserData => { setUserData(latestUserData); })
        .catch(error => {
          setInitialLoadError('Не удалось загрузить данные профиля.');
          setUserData(null);
        })
        .finally(() => { setIsFetchingInitialProfile(false); });
    } else if (!isAuthLoading && !authUser && userData !== null) {
      setUserData(null); // Clear local data if user logs out
    }
  }, [isAuthLoading, authUser, userData, isFetchingInitialProfile, initialLoadError]);

  // --- Effect 2: Load data for the selected tab ---
   const loadTabData = useCallback(async () => {
    if (!userData) return;
    setIsLoadingCourses(true); setCoursesError(null);
    if (activeTab !== ProfileTab.ActiveCourses) setActiveEnrollments([]);
    if (activeTab !== ProfileTab.CompletedCourses) setCompletedEnrollments([]);
    if (activeTab !== ProfileTab.CreatedCourses) setCreatedCourses([]);
    try {
      switch (activeTab) {
        case ProfileTab.ActiveCourses: setActiveEnrollments(await getMyEnrollments('inProgress')); break;
        case ProfileTab.CompletedCourses: setCompletedEnrollments(await getMyEnrollments('completed')); break;
        case ProfileTab.CreatedCourses: setCreatedCourses(await getMyCreatedCourses()); break;
      }
    } catch (error) { setCoursesError(`Не удалось загрузить данные.`); }
    finally { setIsLoadingCourses(false); }
  }, [activeTab, userData]);

  useEffect(() => {
    if (userData) { loadTabData().catch(console.error); }
  }, [userData, activeTab, loadTabData]);


  if (isAuthLoading || (authUser && isFetchingInitialProfile && !userData)) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!authUser) { // Should be caught by ProtectedRoute, but as a fallback
    return <div className="text-center py-12 text-lg">Пожалуйста, войдите, чтобы увидеть профиль.</div>;
  }
  if (initialLoadError && !userData) {
      return <div className="text-center py-12 text-red-600">{initialLoadError}</div>;
  }
  if (!userData) { // Should only show briefly if at all
     return <div className="text-center py-12 text-red-600">Загрузка данных профиля...</div>;
  }

  const renderCoursesTab = () => {
      if (isLoadingCourses) { return (<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>); }
      if (coursesError) { return (<div className="text-center py-16 text-red-500"><p>{coursesError}</p><button onClick={() => loadTabData().catch(console.error)} className="mt-2 px-3 py-1 border border-red-500 rounded text-red-500 hover:bg-red-50 text-sm">Попробовать снова</button></div>); }
      let content: React.ReactNode = null; let isEmpty = false; let emptyMessage = '';
      switch (activeTab) {
          case ProfileTab.ActiveCourses: isEmpty = activeEnrollments.length === 0; emptyMessage = 'У вас пока нет активных курсов.'; content = activeEnrollments.map(enr => <ActiveCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CompletedCourses: isEmpty = completedEnrollments.length === 0; emptyMessage = 'У вас пока нет завершенных курсов.'; content = completedEnrollments.map(enr => <CompletedCourseCard key={enr.course.id} enrollment={enr} />); break;
          case ProfileTab.CreatedCourses: isEmpty = createdCourses.length === 0; emptyMessage = 'Вы пока не создали ни одного курса.'; content = createdCourses.map(course => <CreatedCourseCard key={course.id} course={course} />); break;
      }
      if (isEmpty) { return (<div className="text-center py-16 text-gray-500"><p>{emptyMessage}</p>{activeTab === ProfileTab.CreatedCourses && (<Link to="/create-course" className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 text-sm font-medium">Создать курс</Link>)}</div>); }
      return (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{content}</div>);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header Section (View Mode) */}
        <div className="mb-10 p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-5">
                    <img
                        src={userData.avatarUrl || '/images/default-avatar.png'}
                        alt={userData.fullName || 'Аватар'}
                        className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-full border-2 border-gray-100 shadow-sm"
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{userData.fullName || 'Имя не указано'}</h1>
                        <p className="text-gray-500">{userData.email}</p>
                    </div>
                </div>
                <Link
                    to="/profile/edit" // Link to the new edit page
                    className="text-sm text-white bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 mt-4 sm:mt-0 px-4 py-2 rounded-md shadow-sm font-medium whitespace-nowrap"
                >
                    Редактировать профиль
                </Link>
            </div>
        </div>

        {/* Tabs Section */}
        <div>
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab(ProfileTab.ActiveCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.ActiveCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Активные курсы</button>
                    <button onClick={() => setActiveTab(ProfileTab.CompletedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CompletedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Завершенные курсы</button>
                    <button onClick={() => setActiveTab(ProfileTab.CreatedCourses)} className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm focus:outline-none ${activeTab === ProfileTab.CreatedCourses ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Мои созданные курсы</button>
                </nav>
            </div>
            <div className="min-h-[200px]">
                {renderCoursesTab()}
            </div>
        </div>
    </div>
   );
};

export default ProfilePage;

// ==== File: frontend/src/types/Course.ts ====
export interface LessonSummary {
  id: string;
  title: string;
  type: 'Theory' | 'Coding'; // Ensure backend uses these exact strings
  hasQuiz: boolean;
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgScore: number;
}

export interface Course {
  id: string;
  authorId?: string; // Included in backend model
  authorName: string; // Included in backend model (joined from users)
  coverUrl: string | null; // Make nullable if backend allows it
  title: string;
  description?: string; // Included in backend model
  difficulty: 'Beginner' | 'Middle' | 'Senior'; // Ensure backend uses these exact strings
  language?: string | null; // Make nullable
  tags: string[]; // Included in backend model
  estimatedDuration: number | null; // Make nullable
  version?: number; // Included in backend model
  isPublished?: boolean; // Included in backend model
  stats: CourseStats; // Included in backend model
  lessons: LessonSummary[]; // Included in backend model
}
// Модели для создания и обновления курсов
export interface CourseBase {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Middle' | 'Senior';
  tags?: string[];
  language?: string;
}

export interface CourseCreateRequest extends CourseBase {
  lessons?: LessonContent[];
}

export interface CourseUpdateRequest extends CourseBase {
  lessons?: LessonContent[];
}

export interface LessonContent extends LessonSummary {
  content: string;
  videoUrl?: string;
  quiz?: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: 'choice' | 'shortText' | 'longText';
  options?: { id: string; label: string }[];
}

// ==== File: frontend/src/types/User.ts ====
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

// ==== File: frontend/src/vite-env.d.ts ====
/// <reference types="vite/client" />


// ==== File: frontend/tailwind.config.js ====
/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          orange: {
            DEFAULT: '#e85d04',
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
            950: '#431407',
          },
        },
        boxShadow: {
          card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
        fontFamily: {
          sans: [
            'Inter',
            'system-ui',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ],
        },
      },
    },
    plugins: [
      require('@tailwindcss/line-clamp'),
    ],
  }

// ==== File: frontend/vite.config.ts ====
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})

