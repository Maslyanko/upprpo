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

    const existingUserByEmail = await User.findByEmail(email, true); // Check if email exists
    if (existingUserByEmail) {
      return res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email уже зарегистрирован'
      });
    }

    const newUser = await User.create({
      email,
      password,
      fullName: fullName || email.split('@')[0]
    });
    
    // newUser here is already formatted by User.create (which calls User.findById)
    // It includes dynamic stats.

    // For consistency with login, generate a token and return it
     const token = generateToken({
      id: newUser.id,
      email: newUser.email,
    });

    res.status(201).json({
        user: newUser, // Send the full user object with stats
        accessToken: token
    });

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
    const { email, password } = req.body; // fullName not used for login

    // Find user by email, including password hash for comparison
    const userWithPassword = await User.findByEmail(email, true);
    if (!userWithPassword) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    const isPasswordValid = await User.comparePassword(password, userWithPassword.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    const token = generateToken({
      id: userWithPassword.id,
      email: userWithPassword.email,
    });

    // Fetch user data again, this time formatted and with stats
    const userForResponse = await User.findById(userWithPassword.id);

    res.status(200).json({
      user: userForResponse, // Send the full user object with stats
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
// ==== File: backend/controllers/courseController.js ====
const Course = require('../models/Course');
const Tag = require('../models/Tag'); // For fetching all tags

/**
 * Get all courses with filtering
 * @route GET /courses
 */
const getCourses = async (req, res) => {
  try {
    const { search, difficulty, sort, tags, language } = req.query;

    const tagsArray = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [];

    const filters = {
      search,
      difficulty, // This will be treated as a tag
      sort,
      tags: tagsArray,
      language, // This will also be treated as a tag
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
    const courseData = req.body; // Expects title, description, tags (incl. difficulty, lang), lessonsData
    const authorId = req.user.id;

    // Validate that difficulty is provided as a tag
    const difficultyTag = courseData.tags?.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag));
    if (!difficultyTag) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Необходимо указать тег сложности (Beginner, Middle, или Senior).'
        });
    }

    const newCourse = await Course.create(courseData, authorId);
    res.status(201).json(newCourse);
  } catch (error) {
    console.error('Create course error:', error);
    if (error.message.includes("violates foreign key constraint")) {
        return res.status(400).json({ code: 'INVALID_DATA', message: 'Ошибка в предоставленных данных. Проверьте ID.'});
    }
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

    // If tags are updated, ensure difficulty is still present or correctly handled
    if (updateData.tags) {
        const difficultyTag = updateData.tags.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag));
        if (!difficultyTag) {
             // If difficulty is not in the update, the existing one will persist.
             // If they *remove* difficulty, it's an issue. This validation might be better in the model.
        }
    }

    const updatedCourse = await Course.update(courseId, updateData, authorId);
    res.status(200).json(updatedCourse);
  } catch (error)
 {
    console.error('Update course error:', error);
    if (error.message === 'Course not found or not authorized') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Вы не являетесь автором этого курса или курс не найден' });
    } else if (error.message === 'Cannot update published course. Create a new version.') {
      return res.status(403).json({ code: 'ALREADY_PUBLISHED', message: 'Нельзя редактировать опубликованный курс. Создайте новую версию.' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при обновлении курса' });
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
    const publishedCourse = await Course.publish(courseId, authorId);
    res.status(200).json(publishedCourse);
  } catch (error) {
    console.error('Publish course error:', error);
    if (error.message === 'Course not found or not authorized') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Вы не являетесь автором этого курса или курс не найден' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при публикации курса' });
  }
};

/**
 * Get all unique tags from published courses
 * @route GET /courses/tags
 */
const getAllTags = async (req, res) => {
  try {
    // Fetches tag *names* associated with published courses
    const tagNames = await Tag.getUniqueCourseTagNames();
    res.status(200).json(tagNames); // Send as a simple array of strings
  } catch (error) {
    console.error('Get all tags error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении тегов'
    });
  }
};

/**
 * Delete a course
 * @route DELETE /courses/:courseId
 * @access Private (Author only)
 */
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const authorId = req.user.id;

    // The Course.delete method should handle author check and actual deletion
    await Course.deleteById(courseId, authorId); 
    
    res.status(204).send(); // No content, successful deletion
  } catch (error) {
    console.error('Delete course error:', error);
    if (error.message === 'Course not found or not authorized') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Вы не являетесь автором этого курса или курс не найден для удаления' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при удалении курса' });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  publishCourse,
  getAllTags,
  deleteCourse
};

// ==== File: backend/controllers/enrollmentController.js ====
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

    const enrollment = await Enrollment.enrollCourse(userId, courseId);
    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll course error:', error);
    if (error.message === 'Already enrolled') {
      return res.status(409).json({ code: 'ALREADY_ENROLLED', message: 'Вы уже записаны на этот курс' });
    } else if (error.message === 'Course not found or not published') {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: 'Курс не найден или не опубликован' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при записи на курс' });
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
      return res.status(404).json({ code: 'ENROLLMENT_NOT_FOUND', message: 'Вы не записаны на этот курс' });
    }
    res.status(200).json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при получении прогресса' });
  }
};

/**
 * Rate a course
 * @route POST /courses/:courseId/rating
 */
const rateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { value, comment } = req.body; // Added comment
    const userId = req.user.id;

    if (!value || value < 1 || value > 5) {
      return res.status(400).json({ code: 'INVALID_RATING', message: 'Оценка должна быть от 1 до 5' });
    }

    const rating = await Enrollment.rateCourse(userId, courseId, value, comment);
    res.status(201).json(rating);
  } catch (error) {
    console.error('Rate course error:', error);
    if (error.message === 'Not enrolled in the course') {
      return res.status(403).json({ code: 'NOT_ENROLLED', message: 'Вы не записаны на этот курс' });
    }
    // Removed 'Already rated' as a distinct error, since rateCourse now does an UPSERT.
    // If you want to prevent updates and only allow initial rating, the model logic would need to change.
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при оценке курса' });
  }
};

module.exports = {
  enrollCourse,
  getProgress,
  rateCourse
};

// ==== File: backend/controllers/userController.js ====
// ==== File: backend/controllers/userController.js ====
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Get current user profile
 * @route GET /users/me
 */
const getMe = async (req, res) => {
  try {
    // User.findById now returns user with dynamically calculated stats
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Пользователь не найден'
      });
    }
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
    const { fullName } = req.body; // avatarUrl is handled by uploadAvatar
    const updatedUser = await User.update(req.user.id, { fullName });
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
      return res.status(400).json({ code: 'NO_FILE', message: 'Файл не найден' });
    }
    const avatar = req.files.avatar;
    if (!avatar.mimetype.startsWith('image/')) {
      return res.status(400).json({ code: 'INVALID_FILE_TYPE', message: 'Файл должен быть изображением' });
    }
    if (avatar.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'Размер файла не должен превышать 5MB' });
    }

    const fileExt = path.extname(avatar.name);
    const fileName = `${uuidv4()}${fileExt}`;
    const uploadDir = path.join(__dirname, '../public/uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    await avatar.mv(filePath);
    const avatarUrl = `/uploads/avatars/${fileName}`;

    // Update user record with the new avatar URL
    const updatedUser = await User.update(req.user.id, { avatarUrl });

    res.status(200).json({ avatarUrl: updatedUser.avatarUrl, user: updatedUser }); // Return updated user
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при загрузке аватара' });
  }
};

/**
 * Get user's enrollments by status
 * @route GET /users/me/enrollments
 */
const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    if (!status || !['inProgress', 'completed'].includes(status)) {
      return res.status(400).json({ code: 'INVALID_STATUS', message: 'Необходимо указать статус: inProgress или completed' });
    }
    const enrollments = await Enrollment.findByUserAndStatus(userId, status);
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при получении записей на курсы' });
  }
};

/**
 * Get courses created by the user
 * @route GET /users/me/courses
 */
const getMyCreatedCourses = async (req, res) => {
  try {
    const authorId = req.user.id;
    const courses = await Course.findByAuthor(authorId);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get created courses error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при получении созданных курсов' });
  }
};

module.exports = {
  getMe,
  updateMe,
  uploadAvatar,
  getMyEnrollments,
  getMyCreatedCourses
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
// ==== File: backend/models/Course.js ====
// ==== File: backend/models/Course.js ====
const db = require('../config/db');
const Tag = require('./Tag'); // For tag handling

/**
 * Helper to get course tags by course ID.
 * @param {string} courseId
 * @param {Object} client - Optional DB client for transactions
 * @returns {Promise<Array<string>>} Array of tag names
 */
const getCourseTagNames = async (courseId, client = db) => {
  const result = await client.query(
    'SELECT t.name FROM tags t JOIN course_tags ct ON t.id = ct.tag_id WHERE ct.course_id = $1 ORDER BY t.name',
    [courseId]
  );
  return result.rows.map(row => row.name);
};

/**
 * Helper to get lesson summaries for a course.
 * @param {string} courseId
 * @param {Object} client - Optional DB client for transactions
 * @returns {Promise<Array<Object>>}
 */
const getCourseLessonSummaries = async (courseId, client = db) => {
  const lessonsResult = await client.query(
    `SELECT l.id, l.title, l.sort_order, l.description
     FROM lessons l
     WHERE l.course_id = $1
     ORDER BY l.sort_order`,
    [courseId]
  );

  const lessons = [];
  for (const lessonRow of lessonsResult.rows) {
    const quizPageCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM lesson_pages lp
         JOIN questions q ON lp.id = q.page_id
         WHERE lp.lesson_id = $1 AND lp.page_type = 'ASSIGNMENT'
       ) as has_quiz`,
      [lessonRow.id]
    );
    lessons.push({
      id: lessonRow.id,
      title: lessonRow.title,
      description: lessonRow.description,
      sort_order: lessonRow.sort_order,
      hasQuiz: quizPageCheck.rows[0].has_quiz,
    });
  }
  return lessons;
};

/**
 * Format course data for API response.
 * @param {Object} courseRow - Raw course data from DB.
 * @param {Array<string>} tags - Array of tag names.
 * @param {Array<Object>} lessons - Array of lesson summaries or detailed lessons.
 * @returns {Object} Formatted course data.
 */
const formatCourseData = (courseRow, tags, lessons) => {
  const difficultyTag = tags.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag)) || null;
  const KNOWN_LANGUAGES_FOR_FORMAT = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'];
  const languageTag = tags.find(tag => KNOWN_LANGUAGES_FOR_FORMAT.includes(tag)) || null;

  return {
    id: courseRow.id,
    authorId: courseRow.author_id,
    authorName: courseRow.author_name,
    title: courseRow.title,
    description: courseRow.description,
    coverUrl: courseRow.cover_url,
    estimatedDuration: courseRow.estimated_duration,
    version: courseRow.version,
    isPublished: courseRow.is_published,
    tags: tags || [],
    difficulty: difficultyTag,
    language: languageTag,
    stats: {
      enrollments: parseInt(courseRow.enrollments, 10) || 0,
      avgCompletion: parseFloat(courseRow.avg_completion) || 0,
      avgRating: parseFloat(courseRow.avg_rating) || 0,
    },
    lessons: lessons || [],
    createdAt: courseRow.created_at,
    updatedAt: courseRow.updated_at,
  };
};

const findAll = async (filters = {}) => {
  const { search, tags: filterTags = [], difficulty, language } = filters;

  let query = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
  `;
  const whereConditions = ["c.is_published = true"];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`(c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const allFilterTagNames = [...filterTags];
  if (difficulty) allFilterTagNames.push(difficulty);
  if (language) allFilterTagNames.push(language);

  if (allFilterTagNames.length > 0) {
    const tagPlaceholders = allFilterTagNames.map((_, i) => `$${paramIndex + i}`).join(',');
    whereConditions.push(`
      c.id IN (
        SELECT ct.course_id
        FROM course_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name IN (${tagPlaceholders})
        GROUP BY ct.course_id
        HAVING COUNT(DISTINCT t.id) = ${allFilterTagNames.length}
      )
    `);
    queryParams.push(...allFilterTagNames);
    paramIndex += allFilterTagNames.length;
  }

  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  query += ` ORDER BY c.created_at DESC`;

  const result = await db.query(query, queryParams);

  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id);
    const lessonSummaries = await getCourseLessonSummaries(row.id);
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

const findById = async (id, version = null, client = db) => {
  let queryText = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    WHERE c.id = $1
  `;
  const queryParams = [id];
  if (version) {
    queryText += ` AND c.version = $2`;
    queryParams.push(version);
  }
  queryText += ` ORDER BY c.version DESC LIMIT 1`;

  const result = await client.query(queryText, queryParams);
  if (result.rows.length === 0) return null;

  const courseRow = result.rows[0];
  const courseTags = await getCourseTagNames(courseRow.id, client);

  const lessonsResult = await client.query(
    `SELECT id, title, description, sort_order FROM lessons WHERE course_id = $1 ORDER BY sort_order`,
    [courseRow.id]
  );

  const detailedLessons = [];
  for (const lesson of lessonsResult.rows) {
    const pagesResult = await client.query(
      `SELECT id, title, page_type, sort_order FROM lesson_pages WHERE lesson_id = $1 ORDER BY sort_order`,
      [lesson.id]
    );
    const pages = [];
    for (const page of pagesResult.rows) {
      let pageDetails = { ...page, content: null, questions: [] };
      if (page.page_type === 'METHODICAL') {
        const contentResult = await client.query('SELECT content FROM methodical_page_content WHERE page_id = $1', [page.id]);
        if (contentResult.rows.length > 0) {
          pageDetails.content = contentResult.rows[0].content;
        }
      } else if (page.page_type === 'ASSIGNMENT') {
        const questionsResult = await client.query( // Fetch correct_answer
          'SELECT id, text, type, correct_answer, sort_order FROM questions WHERE page_id = $1 ORDER BY sort_order',
          [page.id]
        );
        for (const question of questionsResult.rows) {
          const optionsResult = await client.query(
            'SELECT id, label, is_correct, sort_order FROM question_options WHERE question_id = $1 ORDER BY sort_order',
            [question.id]
          );
          pageDetails.questions.push({ ...question, options: optionsResult.rows });
        }
      }
      pages.push(pageDetails);
    }
    detailedLessons.push({ ...lesson, pages });
  }
  return formatCourseData(courseRow, courseTags, detailedLessons);
};

async function _updateOrInsertLessons(client, courseId, lessonsData) {
  await client.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);

  if (lessonsData && Array.isArray(lessonsData)) {
    for (let lessonIdx = 0; lessonIdx < lessonsData.length; lessonIdx++) {
      const lessonInput = lessonsData[lessonIdx];
      const lessonResult = await client.query(
        `INSERT INTO lessons (course_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [courseId, lessonInput.title, lessonInput.description || null, lessonIdx]
      );
      const lessonId = lessonResult.rows[0].id;

      if (Array.isArray(lessonInput.pages)) {
        for (let pageIdx = 0; pageIdx < lessonInput.pages.length; pageIdx++) {
          const pageInput = lessonInput.pages[pageIdx];
          const pageResult = await client.query(
            `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [lessonId, pageInput.title, pageInput.page_type, pageIdx]
          );
          const pageId = pageResult.rows[0].id;

          if (pageInput.page_type === 'METHODICAL' && pageInput.content) {
            await client.query(
              'INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
              [pageId, pageInput.content]
            );
          } else if (pageInput.page_type === 'ASSIGNMENT' && Array.isArray(pageInput.questions)) {
            for (let questionIdx = 0; questionIdx < pageInput.questions.length; questionIdx++) {
              const qInput = pageInput.questions[questionIdx];
              console.log(`[COURSE MODEL DEBUG] Inserting Question for page ${pageId}:`);
              console.log(`  Text: ${qInput.text}`);
              console.log(`  Type: ${qInput.type}`);
              console.log(`  Correct Answer (from qInput): '${qInput.correct_answer}' (Type: ${typeof qInput.correct_answer})`);
              console.log(`  Sort Order: ${questionIdx}`);
              const questionResult = await client.query( // Insert correct_answer
                `INSERT INTO questions (page_id, text, type, correct_answer, sort_order)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [pageId, qInput.text, qInput.type, qInput.correct_answer || null, questionIdx]
              );
              const questionId = questionResult.rows[0].id;

              if (Array.isArray(qInput.options)) {
                for (let optionIdx = 0; optionIdx < qInput.options.length; optionIdx++) {
                  const optInput = qInput.options[optionIdx];
                  await client.query(
                    `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                     VALUES ($1, $2, $3, $4)`,
                    [questionId, optInput.label, optInput.is_correct || false, optionIdx]
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}

const create = async (courseData, authorId) => {
  const {
    title, description, tags = [],
    coverUrl = '/images/courses/default.png',
    estimatedDuration = 0,
    lessonsData = [],
  } = courseData;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const courseResult = await client.query(
      `INSERT INTO courses (author_id, title, description, cover_url, estimated_duration, version, is_published)
       VALUES ($1, $2, $3, $4, $5, 1, false) RETURNING *`,
      [authorId, title, description, coverUrl, estimatedDuration]
    );
    const course = courseResult.rows[0];
    const courseId = course.id;

    await client.query('INSERT INTO course_stats (course_id) VALUES ($1)', [courseId]);

    if (tags.length > 0) {
      for (const tagName of tags) {
        const tag = await Tag.findOrCreate(tagName, client);
        await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tag.id]);
      }
    }
    
    await _updateOrInsertLessons(client, courseId, lessonsData);

    await client.query('COMMIT');
    return findById(courseId, null, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const publish = async (courseId, authorId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const courseCheck = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found or not authorized');
    }
    await client.query(
      'UPDATE courses SET is_published = true, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [courseId]
    );
    await client.query('COMMIT');
    return findById(courseId, null, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error publishing course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const findByAuthor = async (authorId) => {
  const query = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    WHERE c.author_id = $1
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(query, [authorId]);
  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id);
    const lessonSummaries = await getCourseLessonSummaries(row.id);
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

const update = async (courseId, updateData, authorId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const courseCheckResult = await client.query(
      'SELECT is_published, author_id FROM courses WHERE id = $1',
      [courseId]
    );
    if (courseCheckResult.rows.length === 0) throw new Error('Course not found');
    
    const courseInfo = courseCheckResult.rows[0];
    if (courseInfo.author_id !== authorId) throw new Error('Not authorized to update this course');
    
    // Simplified check: if lessons are part of the payload, assume it's a content update.
    const isContentUpdate = updateData.lessons !== undefined;

    if (courseInfo.is_published && !isContentUpdate) { 
         throw new Error('Cannot update published course facade. Create a new version or unpublish first.');
    }

    const { title, description, coverUrl, estimatedDuration, tags, lessons } = updateData;

    const courseUpdateFields = [];
    const courseUpdateValues = [];
    let courseParamIdx = 1;

    const addField = (field, value) => {
      if (value !== undefined) {
        courseUpdateFields.push(`${field} = $${courseParamIdx++}`);
        courseUpdateValues.push(value);
      }
    };

    if (!isContentUpdate) { // Only update these if it's primarily a facade update
        addField('title', title);
        addField('description', description);
        addField('cover_url', coverUrl);
        addField('estimated_duration', estimatedDuration);
    }

    if (courseUpdateFields.length > 0) {
      courseUpdateValues.push(courseId);
      await client.query(
        `UPDATE courses SET ${courseUpdateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${courseParamIdx}`,
        courseUpdateValues
      );
    }

    if (tags !== undefined && !isContentUpdate) { 
      await client.query('DELETE FROM course_tags WHERE course_id = $1', [courseId]);
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          const tag = await Tag.findOrCreate(tagName, client);
          await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tag.id]);
        }
      }
    }
    
    if (lessons !== undefined && Array.isArray(lessons)) { // Check for lessons specifically
      await _updateOrInsertLessons(client, courseId, lessons);
      if (courseInfo.is_published) { // If content of a published course changes, bump version
        await client.query('UPDATE courses SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [courseId]);
      }
    }

    await client.query('COMMIT');
    return findById(courseId, null, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const deleteById = async (courseId, authorId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify author and course existence
    const courseCheck = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found or not authorized');
    }

    // Deletion will cascade due to ON DELETE CASCADE in DB schema
    // (course_tags, course_stats, lessons -> lesson_pages -> etc., enrollments, ratings)
    await client.query('DELETE FROM courses WHERE id = $1', [courseId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting course:", error);
    throw error; // Re-throw to be caught by controller
  } finally {
    client.release();
  }
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  publish,
  findByAuthor,
  getCourseTagNames,
  getCourseLessonSummaries,
  formatCourseData,
  deleteById
};

// ==== File: backend/models/Enrollment.js ====
// ==== File: backend/models/Enrollment.js ====
const db = require('../config/db');
const CourseModel = require('./Course'); // To use formatting and helper functions

/**
 * Получение записей пользователя на курсы по статусу
 * @param {string} userId - ID пользователя
 * @param {string} status - Статус ('inProgress', 'completed')
 * @returns {Promise<Array>} - Массив записей с данными курсов
 */
const findByUserAndStatus = async (userId, status) => {
  const query = `
    SELECT
      e.user_id, e.course_id, e.status, e.progress, e.started_at, e.finished_at,
      c.id as course_id_from_c, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      r.value as user_rating_value
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    LEFT JOIN ratings r ON r.course_id = c.id AND r.user_id = e.user_id
    WHERE e.user_id = $1 AND e.status = $2
    ORDER BY e.started_at DESC;
  `;

  const result = await db.query(query, [userId, status]);

  return Promise.all(result.rows.map(async (row) => {
    // Reconstruct a course-like object for formatCourseData
    const courseDataForFormatting = {
      id: row.course_id_from_c, // Use alias to avoid conflict
      author_id: row.author_id,
      author_name: row.author_name,
      title: row.title,
      description: row.description,
      cover_url: row.cover_url,
      estimated_duration: row.estimated_duration,
      version: row.version,
      is_published: row.is_published,
      enrollments: row.enrollments,
      avg_completion: row.avg_completion,
      avg_rating: row.avg_rating, // Use new name
      created_at: null, // Not directly available, not crucial for this view
      updated_at: null, // Not directly available
    };

    const tags = await CourseModel.getCourseTagNames(row.course_id_from_c);
    // Lesson summaries might be too much for this list view, can be simplified or fetched on demand
    const lessonSummaries = await CourseModel.getCourseLessonSummaries(row.course_id_from_c);
    const formattedCourse = CourseModel.formatCourseData(courseDataForFormatting, tags, lessonSummaries);

    return {
      status: row.status,
      progress: row.progress,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      userRating: row.user_rating_value, // Rating from the ratings table
      course: formattedCourse,
    };
  }));
};


/**
 * Запись пользователя на курс
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object>} - Созданная запись
 */
const enrollCourse = async (userId, courseId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const courseResult = await client.query(
      'SELECT is_published FROM courses WHERE id = $1',
      [courseId]
    );
    if (courseResult.rows.length === 0 || !courseResult.rows[0].is_published) {
      throw new Error('Course not found or not published');
    }

    const existingEnrollment = await client.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existingEnrollment.rows.length > 0) {
      throw new Error('Already enrolled');
    }

    const result = await client.query(
      `INSERT INTO enrollments (user_id, course_id, status, progress, started_at)
       VALUES ($1, $2, 'inProgress', 0, CURRENT_TIMESTAMP) RETURNING *`,
      [userId, courseId]
    );

    await client.query(
      `UPDATE course_stats SET enrollments = enrollments + 1 WHERE course_id = $1`,
      [courseId]
    );
    
    // User stats are now dynamic, so no update to user_stats table here.
    // The User model's findById/findByEmail will calculate active_courses.

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error enrolling in course:", error);
    throw error;
  } finally {
    client.release();
  }
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
 * @param {string} comment - Optional comment
 * @returns {Promise<Object>} - Созданная оценка
 */
const rateCourse = async (userId, courseId, value, comment = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const enrollment = await getProgress(userId, courseId); // Uses default pool, fine for read
    if (!enrollment) {
      throw new Error('Not enrolled in the course');
    }
    // Optionally allow rating only completed courses
    // if (enrollment.status !== 'completed') {
    //   throw new Error('Course must be completed to rate');
    // }

    // Upsert rating (Insert or Update if exists)
    const result = await client.query(
      `INSERT INTO ratings (user_id, course_id, value, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET value = EXCLUDED.value, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, courseId, value, comment]
    );

    // Update average rating in course_stats
    await client.query(
      `UPDATE course_stats
       SET avg_rating = (SELECT AVG(value)::numeric(3,2) FROM ratings WHERE course_id = $1)
       WHERE course_id = $1`,
      [courseId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error rating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findByUserAndStatus,
  enrollCourse,
  getProgress,
  rateCourse,
};

// ==== File: backend/models/Lesson.js ====


// ==== File: backend/models/Rating.js ====


// ==== File: backend/models/Tag.js ====
// ==== File: backend/models/Tag.js ====
const db = require('../config/db');

/**
 * Find a tag by its name.
 * @param {string} name - The name of the tag.
 * @returns {Promise<Object|null>} The tag object or null if not found.
 */
const findByName = async (name) => {
  const result = await db.query('SELECT * FROM tags WHERE name = $1', [name]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Find a tag by its ID.
 * @param {string} id - The UUID of the tag.
 * @returns {Promise<Object|null>} The tag object or null if not found.
 */
const findById = async (id) => {
  const result = await db.query('SELECT * FROM tags WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Create a new tag if it doesn't exist, or return the existing one.
 * @param {string} name - The name of the tag.
 * @param {Object} client - Optional database client for transactions.
 * @returns {Promise<Object>} The created or existing tag object.
 */
const findOrCreate = async (name, client = db) => {
  const existingTag = await client.query('SELECT * FROM tags WHERE name = $1', [name]);
  if (existingTag.rows.length > 0) {
    return existingTag.rows[0];
  }
  const result = await client.query(
    'INSERT INTO tags (name) VALUES ($1) RETURNING *',
    [name]
  );
  return result.rows[0];
};

/**
 * Get all tags.
 * @returns {Promise<Array<Object>>} A list of all tags.
 */
const getAll = async () => {
  const result = await db.query('SELECT id, name FROM tags ORDER BY name');
  return result.rows;
};

/**
 * Get all unique tag names that are associated with at least one published course.
 * @returns {Promise<Array<string>>} An array of tag names.
 */
const getUniqueCourseTagNames = async () => {
    const query = `
        SELECT DISTINCT t.name
        FROM tags t
        JOIN course_tags ct ON t.id = ct.tag_id
        JOIN courses c ON ct.course_id = c.id
        WHERE c.is_published = true
        ORDER BY t.name;
    `;
    const result = await db.query(query);
    return result.rows.map(row => row.name);
};


module.exports = {
  findByName,
  findById,
  findOrCreate,
  getAll,
  getUniqueCourseTagNames,
};

// ==== File: backend/models/User.js ====
// ==== File: backend/models/User.js ====
const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Calculate user statistics dynamically.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} User statistics object.
 */
const calculateUserStats = async (userId) => {
  // Active courses: count of enrollments with status 'inProgress'
  const activeCoursesResult = await db.query(
    "SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1 AND status = 'inProgress'",
    [userId]
  );
  const activeCourses = parseInt(activeCoursesResult.rows[0].count, 10) || 0;

  // Completed courses: count of enrollments with status 'completed'
  const completedCoursesResult = await db.query(
    "SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1 AND status = 'completed'",
    [userId]
  );
  const completedCourses = parseInt(completedCoursesResult.rows[0].count, 10) || 0;

  // Average score: This is complex.
  // For now, let's use average of ratings GIVEN BY the user for completed courses.
  // Or average progress if no ratings. This is a placeholder and might need refinement.
  // A more robust avg_score would involve scores from lesson_progress or question attempts.
  // For simplicity, we will set it to 0 for now as the original user_stats.avg_score was also likely a placeholder.
  const avgScore = 0; // Placeholder

  return {
    activeCourses,
    completedCourses,
    avgScore, // Placeholder for now
  };
};

/**
 * Formats user data for API response, including calculated stats.
 * @param {Object} userData - Raw user data from the database.
 * @param {Object} stats - Calculated user statistics.
 * @returns {Object} Formatted user data.
 */
const formatUserDataWithStats = (userData, stats) => {
  const { password, ...userWithoutPassword } = userData; // Exclude password
  return {
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    fullName: userWithoutPassword.full_name,
    avatarUrl: userWithoutPassword.avatar_url,
    createdAt: userWithoutPassword.created_at,
    updatedAt: userWithoutPassword.updated_at,
    stats: stats || { activeCourses: 0, completedCourses: 0, avgScore: 0 },
  };
};


/**
 * Поиск пользователя по email
 * @param {string} email - Email пользователя
 * @param {boolean} includePassword - Whether to include the password hash (for login).
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findByEmail = async (email, includePassword = false) => {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  if (includePassword) {
    return user; // Return raw user data including password for login comparison
  }

  const stats = await calculateUserStats(user.id);
  return formatUserDataWithStats(user, stats);
};

/**
 * Поиск пользователя по ID
 * @param {string} id - ID пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findById = async (id) => {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }
  const user = result.rows[0];
  const stats = await calculateUserStats(user.id);
  return formatUserDataWithStats(user, stats);
};

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise<Object>} - Созданный пользователь
 */
const create = async (userData) => {
  const { email, password, fullName = null } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  // No transaction needed here as user_stats table is removed
  const userResult = await db.query(
    'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING id',
    [email, hashedPassword, fullName]
  );
  const userId = userResult.rows[0].id;
  return findById(userId); // Fetch with calculated stats
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
    return findById(id); // No changes, just return current data
  }

  values.push(id); // For WHERE id = $counter

  await db.query(
    `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${counter} RETURNING id`,
    values
  );

  return findById(id); // Fetch updated user with stats
};

/**
 * Проверка пароля
 * @param {string} password - Введенный пароль
 * @param {string} hashedPassword - Хэшированный пароль из базы
 * @returns {Promise<boolean>} - Результат проверки
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// updateAvatar is effectively handled by the general update method if avatarUrl is passed.
// If a direct method is preferred, it can be kept, but it's redundant.
// For now, I'll remove the specific updateAvatar as `update` covers it.

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  comparePassword,
  // formatUserDataWithStats // Not typically exposed, used internally
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
  publishCourse,
  getAllTags,
  deleteCourse
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
 * @route GET /courses/tags
 * @desc Get all unique course tags
 * @access Public
 */
router.get('/tags', getAllTags); // <-- ADDED ROUTE

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

/**
 * @route DELETE /courses/:courseId
 * @desc Delete a course
 * @access Private (Author only)
 */
router.delete('/:courseId', protect, deleteCourse);

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
// ==== File: backend/scripts/seed.js ====
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db'); // Assuming db.pool for client usage
const TagModel = require('../models/Tag'); // To use findOrCreate

// --- Test Data Definitions ---
const usersData = [
  { email: 'ivan@example.com', password: 'password', fullName: 'Иван Иванов' },
  { email: 'polina@example.com', password: 'password', fullName: 'Полина Смирнова' },
  { email: 'user@example.com', password: 'password', fullName: 'Тестовый Пользователь' },
];

const predefinedTags = [
    "Python", "JavaScript", "SQL", "Java", "C++", "Go", "Ruby", "PHP",
    "Beginner", "Middle", "Senior",
    "Backend", "Frontend", "Fullstack", "DevOps", "Data Science", "Machine Learning",
    "Algorithms", "Data Structures", "System Design", "Soft Skills", "Interview Prep",
    "Web Development", "Mobile Development", "Game Development", "Cybersecurity",
    "Cloud Computing", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
    "React", "Angular", "Vue.js", "Node.js", "Django", "Flask", "Spring Boot",
    "Analytics", "Excel", "HR", "Agile", "Scrum", "Product Management"
];


const coursesData = [
  {
    title: 'Подготовка к Python Middle собеседованию',
    description: 'Полноценный курс для подготовки к Python Middle собеседованиям.',
    tags: ['Python', 'Middle', 'Backend', 'Algorithms'], // Tag names
    authorEmail: 'ivan@example.com',
    coverUrl: '/images/courses/python.png',
    estimatedDuration: 20,
    lessons: [
      {
        title: 'Основы Python для Middle', description: 'Ключевые концепции Python.',
        pages: [
          { title: 'Введение в GIL', pageType: 'METHODICAL', content: '# GIL\nGlobal Interpreter Lock...' },
          { title: 'Декораторы', pageType: 'METHODICAL', content: '# Декораторы\nПримеры декораторов...' },
          {
            title: 'Тест по основам', pageType: 'ASSIGNMENT',
            questions: [
              { text: 'Что такое GIL?', type: 'TEXT_INPUT' },
              { text: 'Приведите пример замыкания.', type: 'CODE_INPUT' },
            ]
          }
        ]
      },
      // More lessons
    ]
  },
  // More courses
];


async function seedDatabase() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Очистка таблиц...');
    // Order matters due to FK constraints if not using CASCADE effectively
    await client.query('TRUNCATE TABLE ratings, enrollments, lesson_progress, question_options, questions, methodical_page_content, lesson_pages, lessons, course_tags, course_stats, courses, tags, users CASCADE;');
    console.log('Таблицы очищены.');

    // 1. Seed Tags
    console.log('Создание тегов...');
    const createdTagsMap = new Map(); // name -> id
    for (const tagName of predefinedTags) {
        const tag = await TagModel.findOrCreate(tagName, client);
        createdTagsMap.set(tag.name, tag.id);
    }
    console.log(`${createdTagsMap.size} тегов создано/найдено.`);

    // 2. Seed Users
    console.log('Создание пользователей...');
    const createdUsersMap = new Map(); // email -> id
    for (const userData of usersData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userResult = await client.query(
        'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING id, email',
        [userData.email, hashedPassword, userData.fullName]
      );
      createdUsersMap.set(userResult.rows[0].email, userResult.rows[0].id);
    }
    console.log(`${createdUsersMap.size} пользователей создано.`);

    // 3. Seed Courses, Lessons, Pages, Questions
    console.log('Создание курсов...');
    for (const courseItem of coursesData) {
      const authorId = createdUsersMap.get(courseItem.authorEmail);
      if (!authorId) {
        console.warn(`Автор ${courseItem.authorEmail} не найден для курса ${courseItem.title}. Пропуск курса.`);
        continue;
      }

      // Create Course
      const courseRes = await client.query(
        `INSERT INTO courses (author_id, title, description, cover_url, estimated_duration, version, is_published)
         VALUES ($1, $2, $3, $4, $5, 1, true) RETURNING id`,
        [authorId, courseItem.title, courseItem.description, courseItem.coverUrl, courseItem.estimatedDuration]
      );
      const courseId = courseRes.rows[0].id;

      // Create Course Stats
      await client.query('INSERT INTO course_stats (course_id, enrollments, avg_completion, avg_rating) VALUES ($1, $2, $3, $4)',
        [courseId, Math.floor(Math.random() * 100), Math.random() * 100, (Math.random() * 2 + 3).toFixed(2) ] // Random stats
      );

      // Link Tags to Course
      for (const tagName of courseItem.tags) {
        const tagId = createdTagsMap.get(tagName);
        if (tagId) {
          await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tagId]);
        } else {
          console.warn(`Тег "${tagName}" не найден в predefinedTags для курса ${courseItem.title}`);
        }
      }

      // Create Lessons
      let lessonSortOrder = 0;
      for (const lessonItem of courseItem.lessons || []) {
        const lessonRes = await client.query(
          `INSERT INTO lessons (course_id, title, description, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [courseId, lessonItem.title, lessonItem.description, lessonSortOrder++]
        );
        const lessonId = lessonRes.rows[0].id;

        // Create Lesson Pages
        let pageSortOrder = 0;
        for (const pageItem of lessonItem.pages || []) {
          const pageRes = await client.query(
            `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [lessonId, pageItem.title, pageItem.pageType, pageSortOrder++]
          );
          const pageId = pageRes.rows[0].id;

          // Create Methodical Page Content
          if (pageItem.pageType === 'METHODICAL' && pageItem.content) {
            await client.query('INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
              [pageId, pageItem.content]
            );
          }
          // Create Questions for Assignment Pages
          else if (pageItem.pageType === 'ASSIGNMENT' && pageItem.questions) {
            let questionSortOrder = 0;
            for (const questionItem of pageItem.questions) {
              const questionRes = await client.query(
                `INSERT INTO questions (page_id, text, type, sort_order)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [pageId, questionItem.text, questionItem.type, questionSortOrder++]
              );
              const questionId = questionRes.rows[0].id;

              // Create Question Options
              let optionSortOrder = 0;
              for (const optionItem of questionItem.options || []) {
                await client.query(
                  `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                   VALUES ($1, $2, $3, $4)`,
                  [questionId, optionItem.label, optionItem.isCorrect || false, optionSortOrder++]
                );
              }
            }
          }
        }
      }
      console.log(`Курс "${courseItem.title}" создан.`);
    }

    // 4. Seed Enrollments and Ratings (Example for 'user@example.com')
    const testUserId = createdUsersMap.get('user@example.com');
    if (testUserId) {
        console.log('Создание записей и оценок для user@example.com...');
        const someCoursesRes = await client.query('SELECT id FROM courses WHERE author_id != $1 LIMIT 2', [testUserId]); // Enroll in courses not authored by testUser
        for (const courseRow of someCoursesRes.rows) {
            const courseIdToEnroll = courseRow.id;
            // Enroll
            await client.query(
                `INSERT INTO enrollments (user_id, course_id, status, progress, started_at, finished_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
                [testUserId, courseIdToEnroll, Math.random() > 0.5 ? 'completed' : 'inProgress', Math.random() * 100, Math.random() > 0.5 ? CURRENT_TIMESTAMP : null]
            );
             // Rate if completed
            if (Math.random() > 0.5) { // Simulate some completed courses being rated
                await client.query(
                    `INSERT INTO ratings (user_id, course_id, value, comment)
                     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                    [testUserId, courseIdToEnroll, Math.floor(Math.random() * 3) + 3, 'Отличный курс!']
                );
                // Trigger update of course_stats.avg_rating (could be a trigger in DB too)
                await client.query(
                  `UPDATE course_stats SET avg_rating = (SELECT AVG(value) FROM ratings WHERE course_id = $1) WHERE course_id = $1`,
                  [courseIdToEnroll]
                );
            }
        }
    }


    await client.query('COMMIT');
    console.log('База данных успешно заполнена тестовыми данными!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при заполнении базы данных:', error);
  } finally {
    client.release();
    db.pool.end(); // Close all connections in the pool
  }
}

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
import { BrowserRouter, Routes, Route, Navigate, useParams, Link } from 'react-router-dom'; // Added Link
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import CreateCoursePage from './pages/CreateCoursePage';
import EditCourseContentPage from './pages/EditCourseContentPage';
import CourseManagementPage from './pages/CourseManagementPage'; // NEW IMPORT
import { useAuth } from './hooks/useAuth';

const AboutPage = () => <div className="container mx-auto py-12 text-center">Страница "О нас" в разработке</div>;

const CourseDetailPagePlaceholder = () => {
    const { courseId } = useParams();
    // This could be the public view of the course, or redirect to management if author
    return <div className="container mx-auto py-12 text-center">Просмотр курса: {courseId} (в разработке)</div>;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const NotFoundPage = () => (
  <div className="container mx-auto py-12 text-center">
    <h1 className="text-2xl font-bold mb-4">404 - Страница не найдена</h1>
    <p className="mb-6">Запрашиваемая страница не существует.</p>
    <Link to="/" className="text-orange-500 hover:text-orange-600">Вернуться на главную</Link>
  </div>
);

export default function App() {
  const { isLoading: isAuthGlobalLoading } = useAuth();

  if (isAuthGlobalLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600"></div>
        <p className="ml-4 text-lg text-gray-700">Загрузка приложения...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/profile"
            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/profile/edit"
            element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/create-course"
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
           <Route
            path="/courses/:courseId/edit-facade"
            element={<ProtectedRoute><CreateCoursePage /></ProtectedRoute>}
          />
          <Route
            path="/courses/:courseId/edit-content"
            element={<ProtectedRoute><EditCourseContentPage /></ProtectedRoute>}
          />
          {/* Public facing course detail page */}
          <Route
            path="/courses/:courseId" 
            element={<CourseDetailPagePlaceholder />} // Replace with actual public course view later
          />
          {/* Course Management Page for Author */}
          <Route
            path="/courses/:courseId/manage"
            element={<ProtectedRoute><CourseManagementPage /></ProtectedRoute>}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

// ==== File: frontend/src/api/authApi.ts ====
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

interface AuthResponse { // Backend now returns user object along with token
  user: User;
  accessToken: string;
}

export async function login(data: LoginData): Promise<User> {
  try {
    const response = await client.post<AuthResponse>('/auth/login', data);
    const { user, accessToken } = response.data;

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user)); // Store the user object from response

    return user;
  } catch (error) {
    console.error('Login API error:', error);
    // Clear potentially outdated/invalid local storage on critical auth errors
    if ((error as any).response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    throw error;
  }
}

export async function register(data: RegisterData): Promise<User> {
  try {
    // Register user - backend now logs in and returns user + token directly
    const response = await client.post<AuthResponse>('/auth/register', {
      email: data.email,
      password: data.password,
      fullName: data.fullName
    });
    const { user, accessToken } = response.data;

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  } catch (error) {
    console.error('Register API error:', error);
    throw error;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Consider using react-router navigate for SPA-friendly redirection
  window.location.href = '/'; // Force refresh to reset application state
}

// ==== File: frontend/src/api/client.ts ====
// ==== File: frontend/src/api/client.ts ====
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/v1',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  // console.log('API Request:', config.method?.toUpperCase(), config.url, config.params || '', config.data || ''); // DEBUG: Log requests
  return config;
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

client.interceptors.response.use(
  response => {
    // console.log('API Response Success:', response.config.url, response.status); // DEBUG: Log success
    return response;
  },
  error => {
    // console.error('API Response Error:', error.config?.url, error.response?.status, error.message, error.response?.data); // DEBUG: Log full error

    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      // Avoid clearing credentials and redirecting for login/register failures,
      // or for the initial /users/me call if it fails (useAuth will handle that).
      if (
        !requestUrl.endsWith('/auth/login') &&
        !requestUrl.endsWith('/auth/register') &&
        !(requestUrl.endsWith('/users/me') && !localStorage.getItem('user')) // Don't clear if /me fails & no user was stored yet (initial load scenario)
      ) {
        console.warn(`401 Unauthorized on ${requestUrl}. Clearing token and user.`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if not already on the homepage to avoid loop if homepage itself causes 401
        if (window.location.pathname !== '/') {
          window.location.href = '/'; // Redirect to home page for re-authentication
        }
      } else {
        // console.log(`Auth-related request to ${requestUrl} failed with 401. Error will be handled by the caller.`);
      }
    }
    return Promise.reject(error);
  }
);

export default client;

// ==== File: frontend/src/api/coursesApi.ts ====
// ==== File: frontend/src/api/coursesApi.ts ====
// ==== File: frontend/src/api/coursesApi.ts ====
import client from './client';
import type {
  Course,
  CourseFacadePayload,
  CourseContentUpdatePayload,
} from '../types/Course';
import { getDifficultyFromTags, getLanguageFromTags } from '../types/Course';

const USE_MOCK_DATA = false;

interface ApiCourseParams {
  search?: string;
  sort?: string;
  difficulty?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string;
}

export const mapApiCourseToFrontendCourse = (apiCourse: any): Course => {
  if (!apiCourse || typeof apiCourse !== 'object') {
    console.warn("mapApiCourseToFrontendCourse received invalid data:", apiCourse);
    return {} as Course;
  }
  const tags = Array.isArray(apiCourse.tags) ? apiCourse.tags : [];
  const difficulty = getDifficultyFromTags(tags);
  const language = getLanguageFromTags(tags);

  const lessons = (Array.isArray(apiCourse.lessons) ? apiCourse.lessons : []).map((lesson: any) => ({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    sort_order: lesson.sort_order !== undefined ? lesson.sort_order : lesson.sortOrder, 
    hasQuiz: !!lesson.hasQuiz || (lesson.pages && lesson.pages.some((p:any) => p.page_type === 'ASSIGNMENT' && p.questions?.length > 0)),
    pages: Array.isArray(lesson.pages) ? lesson.pages.map((page: any) => ({
        id: page.id,
        title: page.title,
        page_type: page.page_type,
        sort_order: page.sort_order !== undefined ? page.sort_order : page.sortOrder,
        content: page.content || '',
        questions: Array.isArray(page.questions) ? page.questions.map((q: any) => ({
            id: q.id,
            text: q.text,
            type: q.type,
            correct_answer: q.correct_answer, // Ensure this is mapped
            sort_order: q.sort_order !== undefined ? q.sort_order : q.sortOrder,
            options: Array.isArray(q.options) ? q.options.map(opt => ({
                ...opt,
                sort_order: opt.sort_order !== undefined ? opt.sort_order : opt.sortOrder,
            })) : []
        })) : []
    })) : [],
  }));

  return {
    id: apiCourse.id,
    authorId: apiCourse.authorId,
    authorName: apiCourse.authorName,
    title: apiCourse.title,
    description: apiCourse.description,
    coverUrl: apiCourse.coverUrl || null,
    estimatedDuration: apiCourse.estimatedDuration || null,
    version: apiCourse.version,
    isPublished: apiCourse.isPublished,
    tags: tags,
    difficulty: difficulty,
    language: language,
    stats: {
      enrollments: apiCourse.stats?.enrollments || 0,
      avgCompletion: apiCourse.stats?.avgCompletion || 0,
      avgRating: apiCourse.stats?.avgRating || 0,
    },
    lessons: lessons,
    createdAt: apiCourse.createdAt,
    updatedAt: apiCourse.updatedAt,
  };
};


export async function getCourses(params?: {
  search?: string;
  sort?: string;
  level?: 'Beginner' | 'Middle' | 'Senior';
  language?: string;
  tags?: string[];
}): Promise<Course[]> {
  if (USE_MOCK_DATA) { console.log("getCourses: Using MOCK DATA"); return []; }
  const apiParams: ApiCourseParams = {};
  if (params?.search) apiParams.search = params.search;
  if (params?.sort) apiParams.sort = params.sort;
  
  const filterTags = [...(params?.tags || [])];
  if (params?.level) filterTags.push(params.level);
  if (params?.language && !filterTags.includes(params.language)) {
     filterTags.push(params.language);
  }
  
  if (filterTags.length > 0) {
    apiParams.tags = filterTags.join(',');
  }

  const response = await client.get<any[]>('/courses', { params: apiParams });
  return response.data.map(mapApiCourseToFrontendCourse);
}

export async function getCourseById(id: string, version?: number): Promise<Course> {
  if (USE_MOCK_DATA) { return mapApiCourseToFrontendCourse({ id, title: "Mock Course by ID", lessons: [{id: "l1", title: "Mock Lesson 1", sort_order:0, pages:[]}], tags:[], stats:{enrollments:0, avgCompletion:0, avgRating:0}}); }
  const apiParams: { version?: number } = {};
  if (version) apiParams.version = version;
  const response = await client.get<any>(`/courses/${id}`, { params: apiParams });
  return mapApiCourseToFrontendCourse(response.data);
}

export async function uploadCourseCover(formData: FormData): Promise<{ coverUrl: string }> {
  const response = await client.post<{ avatarUrl: string }>('/users/me/avatar', formData, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  });
  return { coverUrl: response.data.avatarUrl };
}

export async function createCourseFacade(payload: CourseFacadePayload): Promise<Course> {
  const response = await client.post<any>('/courses', payload);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function updateCourseFacade(courseId: string, payload: CourseFacadePayload): Promise<Course> {
  const response = await client.put<any>(`/courses/${courseId}`, payload);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function enrollCourse(courseId: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/enroll`);
  return response.data;
}

export async function rateCourse(courseId: string, value: number, comment?: string): Promise<any> {
  const response = await client.post(`/courses/${courseId}/rating`, { value, comment });
  return response.data;
}

export async function getAvailableTags(): Promise<string[]> {
  if (USE_MOCK_DATA) return ['MockTag1', 'Beginner', 'Python'];
  const response = await client.get<string[]>('/courses/tags');
  return response.data;
}

export async function updateCourseContent(courseId: string, payload: CourseContentUpdatePayload): Promise<Course> {
  if (USE_MOCK_DATA) { return mapApiCourseToFrontendCourse({ id: courseId, title: "Mock Updated Course Title", lessons: payload.lessons || [], tags:[], stats:{enrollments:0, avgCompletion:0, avgRating:0}}); }
  const response = await client.put<any>(`/courses/${courseId}`, payload); 
  return mapApiCourseToFrontendCourse(response.data);
}

export async function publishCourseApi(courseId: string): Promise<Course> {
  const response = await client.post<any>(`/courses/${courseId}/publish`);
  return mapApiCourseToFrontendCourse(response.data);
}

export async function deleteCourseApi(courseId: string): Promise<void> {
  // This is now a real API call
  await client.delete(`/courses/${courseId}`);
}

// ==== File: frontend/src/api/mockData.ts ====
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
// ==== File: frontend/src/api/userApi.ts ====
import client from './client';
import type { User } from '../types/User';
import type { Course } from '../types/Course';
import { mapApiCourseToFrontendCourse } from './coursesApi'; // Import the mapper

interface UpdateProfileData {
  fullName?: string;
  // avatarUrl is handled by uploadAvatar which then calls updateProfile internally or separately
}

export interface EnrollmentWithCourseAPI { // Raw from API
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null;
    course: any; // Raw course data from API
}

export interface EnrollmentWithCourseMapped { // Mapped for frontend use
    status: 'inProgress' | 'completed';
    progress: number;
    startedAt: string;
    finishedAt: string | null;
    userRating: number | null;
    course: Course; // Mapped course data
}


export async function getCurrentUser(): Promise<User> {
  try {
    const response = await client.get<User>('/users/me'); // Assumes backend returns User type directly
    return response.data;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

export async function updateProfile(data: UpdateProfileData): Promise<User> {
  try {
    const response = await client.patch<User>('/users/me', data);
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

export async function uploadAvatar(formData: FormData): Promise<{ avatarUrl: string, user: User }> {
  try {
    // Backend now returns the updated user object along with avatarUrl
    const response = await client.post<{ avatarUrl: string, user: User }>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    // Update local storage with the full updated user from the response
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data; // Contains avatarUrl and the updated user object
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}


export async function getMyEnrollments(status: 'inProgress' | 'completed'): Promise<EnrollmentWithCourseMapped[]> {
  try {
    const response = await client.get<EnrollmentWithCourseAPI[]>('/users/me/enrollments', {
      params: { status }
    });
    return response.data.map(enrollment => ({
        ...enrollment,
        course: mapApiCourseToFrontendCourse(enrollment.course)
    }));
  } catch (error) {
    console.error(`Error getting enrollments for status ${status}:`, error);
    throw error;
  }
}

export async function getMyCreatedCourses(): Promise<Course[]> {
  try {
    const response = await client.get<any[]>('/users/me/courses');
    return response.data.map(mapApiCourseToFrontendCourse);
  } catch (error) {
    console.error('Error getting created courses:', error);
    throw error;
  }
}

// ==== File: frontend/src/components/AuthModal.tsx ====
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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

  const getDifficultyLabel = (difficulty: 'Beginner' | 'Middle' | 'Senior' | null) => {
    if (!difficulty) return 'Не указан';
    switch (difficulty) {
      case 'Beginner': return 'Для начинающих';
      case 'Middle': return 'Средний уровень';
      case 'Senior': return 'Продвинутый'; // Shorter
      default: return difficulty;
    }
  };

  return (
    <div className="h-full">
      <Link to={isAuthenticated ? `/courses/${course.id}` : '#'} className="block h-full group">
        <div className="card bg-gray-300 relative overflow-hidden rounded-2xl h-52 sm:h-56 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
          <img
            src={course.coverUrl || '/images/courses/default.png'} // Fallback
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent rounded-2xl" />
          <div className="absolute inset-0 z-10 p-4 flex flex-col justify-between text-white">
            <div>
              <div className="mb-1 text-xs opacity-90">{course.authorName}</div>
              <h3 className="text-base sm:text-lg font-semibold leading-tight line-clamp-2">
                {course.title}
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-xs sm:text-sm opacity-90">
              {course.stats.avgRating > 0 && (
                <div className="flex items-center">
                  <span className="text-yellow-400 mr-1">★</span>
                  <span>{course.stats.avgRating.toFixed(1)}</span>
                </div>
              )}
              {course.estimatedDuration && (
                <div className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                    <path d="M12 8V12L15 15" strokeWidth="2" strokeLinecap="round" /> <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  </svg>
                  <span>{course.estimatedDuration} ч</span>
                </div>
              )}
              {course.difficulty && (
                <div className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                    <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline">{getDifficultyLabel(course.difficulty)}</span>
                  <span className="sm:hidden">{course.difficulty}</span>
                </div>
              )}
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

// ==== File: frontend/src/components/HeroSection.tsx ====
// ==== File: frontend/src/components/HeroSection.tsx ====
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Добавили useCallback
import { getAvailableTags } from '@/api/coursesApi';

interface HeroSectionProps {
  onTagClick: (tag: string) => void;
}

// Функция для перемешивания массива (алгоритм Фишера-Йейтса)
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array]; // Создаем копию, чтобы не мутировать исходный массив
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const generateMarqueeRowsData = (
  sourceTags: string[],
  numRows: number,
  minItemsPerVisualRow: number
): string[][] => {
  if (!sourceTags || sourceTags.length === 0) {
    const placeholderTag = "#Теги";
    return Array(numRows).fill(null).map(() => Array(minItemsPerVisualRow * 2).fill(placeholderTag));
  }

  const rows: string[][] = [];
  for (let i = 0; i < numRows; i++) {
    // Перемешиваем исходные теги для каждой строки, чтобы строки отличались
    const shuffledSourceTags = shuffleArray(sourceTags);
    const rowItems: string[] = [];
    let currentSourceIndex = i % shuffledSourceTags.length; // Используем i для начального смещения в перемешанном массиве
    const itemsNeededForFullTrackLoop = Math.max(minItemsPerVisualRow * 2, shuffledSourceTags.length * 2);

    for (let j = 0; j < itemsNeededForFullTrackLoop; j++) {
      rowItems.push(shuffledSourceTags[currentSourceIndex]);
      currentSourceIndex = (currentSourceIndex + 1) % shuffledSourceTags.length;
    }
    rows.push(rowItems);
  }
  return rows;
};


const HeroSection: React.FC<HeroSectionProps> = ({ onTagClick }) => {
  const [tagsFromApi, setTagsFromApi] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(true);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const fallbackTags = useMemo(() => [
    '#Популярное', '#Python', '#AI', '#SQL', '#JavaScript',
    '#ТаймМенеджмент', '#ДляНачинающих', '#Java', '#HTML', '#Карьера',
    '#Практика', '#Docker', '#Креативность', '#БезОпыта', '#Тестирование',
    '#DevOps', '#Frontend', '#Backend', '#DataScience', '#MobileDev'
  ], []);

  useEffect(() => {
    const fetchTags = async () => {
      setIsLoadingTags(true);
      setTagsError(null);
      try {
        const fetchedTags = await getAvailableTags();
        if (fetchedTags && fetchedTags.length > 0) {
          setTagsFromApi(fetchedTags.map(tag => `#${tag.trim()}`));
        } else {
          setTagsFromApi(fallbackTags);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
        setTagsFromApi(fallbackTags);
        setTagsError("Не удалось загрузить теги.");
      } finally {
        setIsLoadingTags(false);
      }
    };
    fetchTags();
  }, [fallbackTags]);

  const handleInternalTagClick = useCallback((fullTag: string) => { // useCallback для стабильности ссылки
    const cleanTag = fullTag.startsWith('#') ? fullTag.substring(1) : fullTag;
    onTagClick(cleanTag);
  }, [onTagClick]);

  const marqueeRowsData = useMemo(() => {
    const tagsToUse = (tagsFromApi.length > 0 && !isLoadingTags) ? tagsFromApi : fallbackTags;
    // Увеличим minItemsPerVisualRow, если теги стали крупнее, чтобы обеспечить заполнение
    return generateMarqueeRowsData(tagsToUse, 4, 15); // Уменьшил до 15, т.к. теги станут больше
  }, [tagsFromApi, fallbackTags, isLoadingTags]);

  const animationClasses = [
    'animate-marquee-medium',
    'animate-marquee-slow',
    'animate-marquee-fast',
  ];


  return (
    <div className="bg-orange text-white flex flex-col justify-center min-h-[calc(100vh-4rem)] py-12 sm:py-16 relative overflow-hidden">
      <div className="max-w-3xl w-full z-10 relative px-4 sm:px-6 md:px-8 lg:px-16">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 whitespace-nowrap">
          Подготовься к IT-собеседованию
        </h1>
        <p className="text-lg sm:text-xl text-orange-100 mb-10 text-left">
          Получай мгновенную обратную связь на свои ответы и код.
          <br />
          Готовься эффективнее с AI-hunt.
        </p>
      </div>
      <div className="marquee-container w-full mt-8 sm:mt-12 space-y-3 md:space-y-4 absolute inset-x-0 bottom-0 md:relative md:inset-auto md:top-auto md:bottom-auto overflow-x-hidden">
        {isLoadingTags && tagsFromApi.length === 0 && (
           <p className="text-center text-orange-100 px-4">Загрузка популярных тегов...</p>
        )}
        {tagsError && (<p className="text-center text-red-200 px-4 text-sm">{tagsError}</p>)}

        {marqueeRowsData.map((rowTags, rowIndex) => (
          <div key={rowIndex} className="marquee-row w-full">
            <div className={`marquee-track flex ${animationClasses[rowIndex % animationClasses.length]} min-w-max will-change-transform`}>
              {rowTags.map((tag, tagIndex) => (
                <button
                  key={`row-${rowIndex}-tag-${tagIndex}-${tag.replace('#', '')}`}
                  onClick={() => handleInternalTagClick(tag)}
                  // --- УВЕЛИЧЕНИЕ РАЗМЕРА ТЕГОВ ---
                  // Было: text-xs sm:text-sm px-3 py-1.5
                  // Стало: text-sm sm:text-base px-4 py-2 (примерно в 1.5 раза больше padding и text size)
                  className="bg-gray-900 bg-opacity-60 hover:bg-opacity-80 text-white 
                             text-sm sm:text-sm font-medium px-4 py-2 sm:px-5 sm:py-2.5 rounded-full 
                             cursor-pointer whitespace-nowrap mx-2 sm:mx-3 
                             transition-colors duration-150 
                             focus:outline-none focus:ring-1 focus:ring-orange-300 focus:ring-opacity-50 
                             shrink-0"
                >
                  {tag}
                </button>
              ))}
              {/* Дублирование для плавной анимации, если generateMarqueeRowsData не генерирует достаточно */}
              {/* В нашем случае generateMarqueeRowsData должна справляться */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroSection;

// ==== File: frontend/src/components/Layout.tsx ====
// ==== File: frontend/src/components/Layout.tsx ====
import React from 'react';
import Navbar from './Navbar'; // Check path

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50"> {/* Added a light bg for contrast */}
      <Navbar />
      {/* pt-16 is h-16 (4rem) for navbar height. Ensure Navbar has fixed height or Layout accounts for it. */}
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
          <div className="flex items-center justify-between h-16">
            {/* Левая часть: Логотип */}
            <div className="flex-shrink-0 flex items-center">
              <NavLink to="/" className="flex items-center">
                <span className={`text-2xl font-bold ${logoColor}`}>AI-Hunt</span>
              </NavLink>
            </div>

            {/* Центральная часть: Навигационные ссылки (только для десктопа) */}
            <div className="hidden sm:flex sm:items-center sm:space-x-8">
              <NavLink to="/about" className={({ isActive }) => getLinkClasses(isActive)}>
                О нас
              </NavLink>
              <NavLink
                to="/"
                className={({ isActive }) => {
                  const visuallyActive = isHomePage ? false : isActive;
                  return getLinkClasses(visuallyActive);
                }}
              >
                Курсы
              </NavLink>
              {user && (
                <NavLink to="/create-course" className={({ isActive }) => getLinkClasses(isActive)}>
                  Создать курс
                </NavLink>
              )}
            </div>

            {/* Правая часть: Профиль/Войти (только для десктопа) */}
            <div className="hidden sm:flex sm:items-center">
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

            {/* Кнопка мобильного меню (только для мобильных) */}
            {/* Этот блок будет справа на мобильных, т.к. центральный блок скрыт */}
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

        {/* Выпадающее мобильное меню */}
        {isMenuOpen && (
          <div className={`sm:hidden ${mobilePanelClasses}`}>
            <div className="pt-2 pb-3 space-y-1">
              <NavLink to="/about" className={({ isActive }) => getMobileLinkClasses(isActive)} onClick={() => setIsMenuOpen(false)}>
                О нас
              </NavLink>
              <NavLink 
                to="/" 
                className={({ isActive }) => {
                    const visuallyActive = isHomePage ? false : isActive;
                    return getMobileLinkClasses(visuallyActive);
                }} 
                onClick={() => setIsMenuOpen(false)}
               >
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

// ==== File: frontend/src/components/course_editor/AssignmentPageEditor.tsx ====
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import type { LessonPage, Question } from '@/types/Course';
import QuestionEditor from './QuestionEditor';
import { createNewQuestion } from '@/types/Course';

interface AssignmentPageEditorProps {
  page: LessonPage;
  onQuestionsChange: (pageId: string, newQuestions: Question[]) => void;
  onTitleChange: (pageId: string, newTitle: string) => void;
}

const AssignmentPageEditor: React.FC<AssignmentPageEditorProps> = ({ page, onQuestionsChange, onTitleChange }) => {
  const [title, setTitle] = useState(page.title);
  const [questions, setQuestions] = useState<Question[]>(page.questions || []);

  useEffect(() => {
    setTitle(page.title);
    setQuestions(page.questions || []);
  }, [page]);

  const handleTitleBlur = () => {
    if (title.trim() !== page.title) {
      onTitleChange(page.id, title.trim() || "Без названия");
    }
  };
  
  const handleAddQuestion = () => {
    const newQ = createNewQuestion(questions.length);
    const newQuestions = [...questions, newQ];
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const handleQuestionChange = (updatedQuestion: Question) => {
    const newQuestions = questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q);
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = questions.filter(q => q.id !== questionId).map((q, i) => ({...q, sort_order: i}));
    setQuestions(newQuestions);
    onQuestionsChange(page.id, newQuestions);
  };

  const onQuestionDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const finalQuestions = items.map((q, idx) => ({ ...q, sort_order: idx }));
    setQuestions(finalQuestions);
    onQuestionsChange(page.id, finalQuestions);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor={`pageTitle-assignment-${page.id}`} className="block text-sm font-medium text-gray-700 mb-1">
          Название страницы (задания)
        </label>
        <input
          id={`pageTitle-assignment-${page.id}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Название задания"
          className="form-input w-full"
        />
      </div>

      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Вопросы:</h4>
        {questions.length === 0 && (
            <p className="text-sm text-gray-500 italic">На этой странице пока нет вопросов.</p>
        )}
        <DragDropContext onDragEnd={onQuestionDragEnd}>
            <Droppable droppableId={`questionsList-${page.id}`} type={`questions-${page.id}`}>
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                        {questions.map((q, index) => (
                            <Draggable key={q.id} draggableId={q.id} index={index}>
                                {(providedDraggable) => (
                                    <QuestionEditor
                                        question={q}
                                        index={index}
                                        onQuestionChange={handleQuestionChange}
                                        onDeleteQuestion={handleDeleteQuestion}
                                        provided={providedDraggable}
                                    />
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>

        <button
          onClick={handleAddQuestion}
          className="mt-4 btn-outline text-sm py-2 px-3"
        >
          + Добавить вопрос
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-4">Изменения сохраняются автоматически при общем сохранении уроков.</p>
    </div>
  );
};

export default AssignmentPageEditor;

// ==== File: frontend/src/components/course_editor/ContextMenu.tsx ====
// ==== File: frontend/src/components/course_editor/ContextMenu.tsx ====
import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onAddAfter: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onDelete, onAddAfter }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-48"
      style={{ top: y, left: x }}
    >
      <button
        onClick={() => { onAddAfter(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      >
        Добавить урок после
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        Удалить урок
      </button>
    </div>
  );
};

export default ContextMenu;

// ==== File: frontend/src/components/course_editor/LessonItem.tsx ====
// ==== File: frontend/src/components/course_editor/LessonItem.tsx ====
import React from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import type { LessonIdentifiable } from '@/types/Course';

interface LessonItemProps {
  lesson: LessonIdentifiable;
  index: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onSelectLesson: (lessonId: string) => void;
  onContextMenu: (event: React.MouseEvent, lessonId: string) => void;
  isSelected: boolean;
}

// Компонент для "фиктивного" урока-кнопки "+"
export const AddLessonButtonPlaceholder: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 mb-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 
                 hover:text-orange-600 hover:border-orange-500 transition-colors 
                 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
      title="Добавить новый урок"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};


const LessonItem: React.FC<LessonItemProps> = ({
  lesson,
  index,
  provided,
  snapshot,
  onSelectLesson,
  onContextMenu,
  isSelected,
}) => {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onSelectLesson(lesson.id)}
      onContextMenu={(e) => onContextMenu(e, lesson.id)}
      className={`
        p-3 mb-2 rounded-lg border cursor-grab transition-all duration-150 ease-in-out
        flex items-center space-x-3
        ${snapshot.isDragging ? 'bg-orange-100 border-orange-300 shadow-lg' : 'bg-white border-gray-200 hover:bg-gray-50'}
        ${isSelected ? 'border-orange-500 ring-2 ring-orange-500 ring-offset-0 bg-orange-50' : ''}
      `}
      style={{
        ...provided.draggableProps.style,
      }}
    >
      <span className="text-sm font-medium text-gray-500 w-6 text-center flex-shrink-0">{index + 1}.</span>
      <span className="text-sm text-gray-800 truncate flex-grow min-w-0">{lesson.title || 'Новый урок'}</span>
    </div>
  );
};

export default LessonItem;

// ==== File: frontend/src/components/course_editor/MethodicalPageEditor.tsx ====
import React, { useState, useEffect } from 'react';
import type { LessonPage } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface MethodicalPageEditorProps {
  page: LessonPage;
  onContentChange: (pageId: string, newContent: string) => void;
  onTitleChange: (pageId: string, newTitle: string) => void;
}

const MethodicalPageEditor: React.FC<MethodicalPageEditorProps> = ({ page, onContentChange, onTitleChange }) => {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setTitle(page.title);
    setContent(page.content);
    setShowPreview(false); // Reset to edit mode when page changes
  }, [page]);

  const handleTitleBlur = () => {
    if (title.trim() !== page.title) {
      onTitleChange(page.id, title.trim() || "Без названия");
    }
  };
  
  const handleContentBlur = () => {
    if (content !== page.content) {
      onContentChange(page.id, content);
    }
  };


  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`pageTitle-${page.id}`} className="block text-sm font-medium text-gray-700 mb-1">
          Название страницы
        </label>
        <input
          id={`pageTitle-${page.id}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Название методической страницы"
          className="form-input w-full"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
            <label htmlFor={`pageContent-${page.id}`} className="block text-sm font-medium text-gray-700">
            Содержимое (Markdown)
            </label>
            <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
            >
            {showPreview ? 'Редактировать' : 'Предпросмотр'}
            </button>
        </div>
        {showPreview ? (
            // Apply prose classes for Tailwind Typography styling
            <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none p-3 border border-gray-300 rounded-md min-h-[200px] bg-gray-50">
                {content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown> : <p className="italic text-gray-400">Нет содержимого для предпросмотра.</p>}
            </div>
        ) : (
            <textarea
            id={`pageContent-${page.id}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            placeholder="Введите содержимое страницы в формате Markdown..."
            rows={15}
            className="form-textarea w-full text-sm font-mono" // font-mono helps with markdown editing
            />
        )}
      </div>
       <p className="text-xs text-gray-500">Изменения сохраняются автоматически при потере фокуса полей или при общем сохранении структуры курса.</p>
    </div>
  );
};

export default MethodicalPageEditor;

// ==== File: frontend/src/components/course_editor/PageEditor.tsx ====
import React from 'react';
import type { LessonPage } from '@/types/Course';
import MethodicalPageEditor from './MethodicalPageEditor';
import AssignmentPageEditor from './AssignmentPageEditor';

interface PageEditorProps {
  page: LessonPage | null; // Can be null if no page is selected
  onContentChange: (pageId: string, newContent: string) => void; // For methodical
  onQuestionsChange: (pageId: string, newQuestions: any[]) => void; // For assignment
  onPageTitleChange: (pageId: string, newTitle: string) => void; // For both
}

const PageEditor: React.FC<PageEditorProps> = ({
  page,
  onContentChange,
  onQuestionsChange,
  onPageTitleChange,
}) => {
  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-300 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-gray-500">Выберите страницу для редактирования или добавьте новую.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 max-w-full"> {/* Changed max-w-2xl to full */}
      {page.page_type === 'METHODICAL' && (
        <MethodicalPageEditor
          page={page}
          onContentChange={onContentChange}
          onTitleChange={onPageTitleChange}
        />
      )}
      {page.page_type === 'ASSIGNMENT' && (
        <AssignmentPageEditor
          page={page}
          onQuestionsChange={onQuestionsChange}
          onTitleChange={onPageTitleChange}
        />
      )}
    </div>
  );
};

export default PageEditor;

// ==== File: frontend/src/components/course_editor/PageTabs.tsx ====
import React from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import type { LessonPage } from '@/types/Course';

interface PageTabProps {
  page: LessonPage;
  index: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  isSelected: boolean;
  onSelectPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

const PageTab: React.FC<PageTabProps> = ({ page, index, provided, snapshot, isSelected, onSelectPage, onDeletePage }) => {
  const pageDisplayName = page.title || `Страница ${index + 1}`; // Calculate display name first

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onSelectPage(page.id)}
      className={`
        flex items-center px-3 py-2 mr-2 rounded-md cursor-grab border
        transition-all duration-150 ease-in-out whitespace-nowrap
        ${snapshot.isDragging ? 'bg-orange-100 border-orange-300 shadow-md' : 'bg-white hover:bg-gray-50'}
        ${isSelected ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50 text-orange-700 font-medium' : 'border-gray-300 text-gray-700'}
      `}
      style={{ ...provided.draggableProps.style }}
      title={page.title}
    >
      <span className="text-xs truncate max-w-[120px]">{page.title || `Страница ${index + 1}`}</span>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent onSelectPage
          // Use the pre-calculated pageDisplayName
          if (window.confirm(`Удалить страницу "${pageDisplayName}"?`)) {
            onDeletePage(page.id);
          }
        }}
        className="ml-2 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 focus:outline-none"
        title="Удалить страницу"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export const AddPageButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-2 rounded-md border-2 border-dashed border-gray-300 text-gray-500
                 hover:text-orange-600 hover:border-orange-500 transition-colors
                 focus:outline-none focus:ring-1 focus:ring-orange-500"
      title="Добавить новую страницу"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};

export default PageTab;

// ==== File: frontend/src/components/course_editor/QuestionEditor.tsx ====
// ==== File: frontend/src/components/course_editor/QuestionEditor.tsx ====
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
// import { v4 as uuidv4 } from 'uuid'; // Not used directly here if options are created by parent
import type { Question, QuestionOption } from '@/types/Course';
import { createNewQuestionOption } from '@/types/Course';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onQuestionChange: (updatedQuestion: Question) => void;
  onDeleteQuestion: (questionId: string) => void;
  provided?: any;
  isDragDisabled?: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  onQuestionChange,
  onDeleteQuestion,
  provided,
  isDragDisabled = false
}) => {
  const [text, setText] = useState(question.text);
  const [type, setType] = useState<Question['type']>(question.type);
  const [options, setOptions] = useState<QuestionOption[]>(question.options || []);
  const [correctAnswer, setCorrectAnswer] = useState<string>(question.correct_answer || '');

  useEffect(() => {
    setText(question.text);
    setType(question.type);
    setOptions(question.options || []);
    setCorrectAnswer(question.correct_answer || '');
  }, [question]);

  // Memoized function to prevent unnecessary re-creation if props don't change
  const triggerQuestionUpdate = useCallback(() => {
      onQuestionChange({ 
        id: question.id, // always pass id
        page_id: question.page_id, // pass existing page_id
        text, 
        type, 
        options, 
        correct_answer: correctAnswer, 
        sort_order: question.sort_order // maintain sort_order
    });
  }, [text, type, options, correctAnswer, onQuestionChange, question.id, question.page_id, question.sort_order]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value);
  const handleTextBlur = () => {
    if (text !== question.text) {
        triggerQuestionUpdate();
    }
  };

  const handleCorrectAnswerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCorrectAnswer(e.target.value);
  };
  const handleCorrectAnswerBlur = () => {
    if (correctAnswer !== (question.correct_answer || '')) {
        triggerQuestionUpdate();
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as Question['type'];
    setType(newType); // Update local state first
    
    let newOptionsState = type === newType ? options : []; // Keep options if type is same, else clear
    let newCorrectAnswerState = type === newType ? correctAnswer : '';

    if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newOptionsState = [];
    } else if (newOptionsState.length === 0 && ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newOptionsState = [createNewQuestionOption(0)];
    }
    if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(newType)) {
        newCorrectAnswerState = '';
    }
    
    setOptions(newOptionsState);
    setCorrectAnswer(newCorrectAnswerState);

    // Call onQuestionChange with all updated state values
    onQuestionChange({
        id: question.id,
        page_id: question.page_id,
        text: text, // use current text state
        type: newType,
        options: newOptionsState,
        correct_answer: newCorrectAnswerState,
        sort_order: question.sort_order
    });
  };
  
  const handleOptionChange = (optIndex: number, field: keyof QuestionOption, value: string | boolean) => {
    const newOptions = options.map((opt, i) =>
      i === optIndex ? { ...opt, [field]: value } : opt
    );
    if (type === 'SINGLE_CHOICE' && field === 'is_correct' && value === true) {
        newOptions.forEach((opt, i) => { if (i !== optIndex) opt.is_correct = false; });
    }
    setOptions(newOptions);
    // Update immediately with new options
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const addOption = () => {
    const newOpt = createNewQuestionOption(options.length);
    const newOptions = [...options, newOpt];
    setOptions(newOptions);
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const deleteOption = (optIndex: number) => {
    const newOptions = options.filter((_, i) => i !== optIndex).map((opt, i) => ({...opt, sort_order: i}));
    setOptions(newOptions);
    onQuestionChange({ ...question, text, type, options: newOptions, correct_answer: correctAnswer });
  };

  const onOptionDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(options);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const finalOptions = items.map((opt, idx) => ({ ...opt, sort_order: idx }));
    setOptions(finalOptions);
    onQuestionChange({ ...question, text, type, options: finalOptions, correct_answer: correctAnswer });
  };

  const questionTypeLabels: Record<Question['type'], string> = {
    SINGLE_CHOICE: "Один вариант",
    MULTIPLE_CHOICE: "Несколько вариантов",
    TEXT_INPUT: "Текстовый ответ",
    CODE_INPUT: "Код",
  };

  return (
    <div 
        ref={provided?.innerRef} 
        {...provided?.draggableProps} 
        className="p-4 border border-gray-300 rounded-lg mb-4 bg-white shadow"
        style={provided?.draggableProps.style}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-grow">
            <div className="flex items-center">
                {!isDragDisabled && provided?.dragHandleProps && (
                    <button type="button" {...provided.dragHandleProps} className="p-1 text-gray-400 hover:text-gray-600 mr-2 cursor-grab focus:outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                        </svg>
                    </button>
                )}
                <label htmlFor={`qtext-${question.id}`} className="text-sm font-medium text-gray-700">
                Вопрос {index + 1}
                </label>
            </div>
        </div>
        <button
          onClick={() => onDeleteQuestion(question.id)}
          className="text-red-500 hover:text-red-700 text-xs p-1 rounded hover:bg-red-50"
          title="Удалить вопрос"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <textarea
        id={`qtext-${question.id}`}
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur} // Uses triggerQuestionUpdate via handleTextBlur
        placeholder="Текст вопроса (Markdown)..."
        rows={3}
        className="form-textarea w-full text-sm mb-3"
      />
      <div className="mb-4">
        <label htmlFor={`qtype-${question.id}`} className="text-xs font-medium text-gray-600 mr-2">Тип:</label>
        <select
          id={`qtype-${question.id}`}
          value={type}
          onChange={handleTypeChange} // This now calls onQuestionChange directly
          className="form-select text-xs py-1 px-2 rounded-md"
        >
          {(Object.keys(questionTypeLabels) as Array<Question['type']>).map(key => (
            <option key={key} value={key}>{questionTypeLabels[key]}</option>
          ))}
        </select>
      </div>

      {(type === 'TEXT_INPUT' || type === 'CODE_INPUT') && (
        <div className="mb-4">
          <label htmlFor={`qcorrect-${question.id}`} className="block text-xs font-medium text-gray-600 mb-1">
            Правильный ответ ({type === 'CODE_INPUT' ? 'точная строка или шаблон' : 'точная строка'})
          </label>
          <textarea
            id={`qcorrect-${question.id}`}
            value={correctAnswer}
            onChange={handleCorrectAnswerChange}
            onBlur={handleCorrectAnswerBlur} // Uses triggerQuestionUpdate via handleCorrectAnswerBlur
            placeholder="Введите единственно верный ответ..."
            rows={type === 'CODE_INPUT' ? 4 : 2}
            className="form-textarea w-full text-sm"
          />
           <p className="text-xs text-gray-500 mt-1">Для текстовых ответов сравнение обычно регистрозависимое и чувствительно к пробелам. Для кода, если нужна проверка сложнее, это потребует отдельной логики на бэкенде.</p>
        </div>
      )}

      {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
        <div className="space-y-2 pl-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Варианты ответов:</label>
            <DragDropContext onDragEnd={onOptionDragEnd}>
                <Droppable droppableId={`options-${question.id}`} type={`options-${question.id}`}>
                    {(providedList) => (
                    <div {...providedList.droppableProps} ref={providedList.innerRef}>
                        {options.map((opt, optIndex) => (
                        <Draggable key={opt.id} draggableId={opt.id.toString()} index={optIndex}>
                            {(providedItem) => (
                            <div
                                ref={providedItem.innerRef}
                                {...providedItem.draggableProps}
                                className="flex items-center space-x-2 mb-1.5 p-1.5 bg-gray-50 rounded"
                            >
                                <button type="button" {...providedItem.dragHandleProps} className="p-0.5 text-gray-400 hover:text-gray-600 cursor-grab focus:outline-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>
                                </button>
                                <input
                                    type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                                    name={`qopt-correct-${question.id}-${index}`} // Make name more unique for radios if multiple questions on page
                                    checked={opt.is_correct}
                                    onChange={(e) => handleOptionChange(optIndex, 'is_correct', e.target.checked)}
                                    className={`form-${type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} h-3.5 w-3.5 text-orange-600 focus:ring-orange-500 border-gray-300`}
                                />
                                <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => handleOptionChange(optIndex, 'label', e.target.value)}
                                onBlur={triggerQuestionUpdate} 
                                placeholder={`Вариант ${optIndex + 1}`}
                                className="form-input flex-grow text-xs px-2 py-1"
                                />
                                <button
                                onClick={() => deleteOption(optIndex)}
                                className="text-red-400 hover:text-red-600 text-xs p-0.5 rounded hover:bg-red-50"
                                title="Удалить вариант"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            )}
                        </Draggable>
                        ))}
                        {providedList.placeholder}
                    </div>
                    )}
                </Droppable>
            </DragDropContext>
          <button
            onClick={addOption}
            className="text-xs text-orange-600 hover:text-orange-700 border border-orange-500 rounded px-2 py-1 hover:bg-orange-50"
          >
            + Добавить вариант
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionEditor;

// ==== File: frontend/src/components/course_editor/modals/ChoosePageTypeModal.tsx ====
import React from 'react';

interface ChoosePageTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'METHODICAL' | 'ASSIGNMENT') => void;
}

const ChoosePageTypeModal: React.FC<ChoosePageTypeModalProps> = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Выберите тип страницы</h3>
        <div className="space-y-3">
          <button
            onClick={() => { onSelectType('METHODICAL'); onClose(); }}
            className="w-full btn-primary py-2.5"
          >
            Методическая страница (Markdown)
          </button>
          <button
            onClick={() => { onSelectType('ASSIGNMENT'); onClose(); }}
            className="w-full btn-primary py-2.5"
          >
            Страница с заданиями
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full btn-outline mt-4 py-2.5"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};

export default ChoosePageTypeModal;

// ==== File: frontend/src/components/profile/ActiveCourseCard.tsx ====
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
// ==== File: frontend/src/components/profile/CreatedCourseCard.tsx ====
import React from 'react';
import { Link } from 'react-router-dom';
import { Course, getDifficultyFromTags } from '@/types/Course';

interface CreatedCourseCardProps {
  course: Course;
}

const CreatedCourseCard: React.FC<CreatedCourseCardProps> = ({ course }) => {
  const statusText = course.isPublished ? 'Опубликован' : 'Черновик';
  const statusColor = course.isPublished ? 'text-green-600 bg-green-100' : 'text-yellow-700 bg-yellow-100';
  const difficulty = getDifficultyFromTags(Array.isArray(course.tags) ? course.tags : []) || 'Не указан';

  return (
    <Link 
      to={`/courses/${course.id}/manage`} 
      className="block bg-white rounded-xl p-5 shadow-lg border border-transparent hover:border-orange-400 flex flex-col justify-between h-full group transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 mb-1 line-clamp-2 h-14 transition-colors duration-200">{course.title}</h3>
        <p className="text-xs text-gray-500 mb-3">Сложность: {difficulty}</p>
        <div className="text-sm text-gray-600 space-y-1 mb-4">
            <p>Учеников: <span className="font-medium text-gray-800">{course.stats?.enrollments ?? 0}</span></p>
            <p>Статус: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusText}</span></p>
            {course.isPublished && course.version && <p>Версия: <span className="font-medium text-gray-800">{course.version}</span></p>}
        </div>
      </div>
       <div className="mt-auto flex justify-end items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500 opacity-70 group-hover:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
       </div>
    </Link>
  );
};

export default CreatedCourseCard;

// ==== File: frontend/src/hooks/useAuth.ts ====
// ==== File: frontend/src/hooks/useAuth.ts ====
import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/authApi';
// It's good practice to also fetch user data on initial load if token exists,
// to verify token and get fresh user data.
import { getCurrentUser } from '../api/userApi'; // Import getCurrentUser
import type { User } from '../types/User';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial auth state loading AND token verification

  useEffect(() => {
    const verifyTokenAndFetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // console.log("useAuth: Token found, verifying and fetching user..."); // DEBUG
          const freshUser = await getCurrentUser(); // Fetches /users/me using the token
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser)); // Update stored user
          // console.log("useAuth: User fetched successfully", freshUser); // DEBUG
        } catch (error) {
          // console.error("useAuth: Token verification/user fetch failed", error); // DEBUG
          // Token might be invalid or expired
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        // console.log("useAuth: No token found."); // DEBUG
        // No token, ensure user is null if there was any stale data
        setUser(null);
        localStorage.removeItem('user'); // Clean up potentially stale user data if token is gone
      }
      setIsLoading(false);
    };

    verifyTokenAndFetchUser();
  }, []); // Runs once on mount

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true); // Indicate loading during login process
    try {
      const userData = await apiLogin({ email, password });
      setUser(userData);
      // localStorage is handled by apiLogin
      setIsLoading(false);
      return userData;
    } catch (error) {
      setUser(null);
      setIsLoading(false);
      console.error('useAuth login error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string): Promise<User> => {
    setIsLoading(true); // Indicate loading
    try {
      const userData = await apiRegister({ email, password, fullName });
      setUser(userData);
      // localStorage is handled by apiRegister
      setIsLoading(false);
      return userData;
    } catch (error) {
      setUser(null);
      setIsLoading(false);
      console.error('useAuth register error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout(); // Handles localStorage
    setUser(null);
    // No need to setIsLoading here unless logout involves async operations.
    // Redirect is handled by apiLogout or component.
  }, []);

  const updateUserState = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  return {
    user,
    isLoading, // True while checking auth token or during login/register
    login,
    register,
    logout,
    updateUserState,
    isAuthenticated: !!user && !!localStorage.getItem('token'),
  };
}

// ==== File: frontend/src/hooks/useCourses.ts ====
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

// ==== File: frontend/src/index.tsx ====
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(<App />);


// ==== File: frontend/src/main.tsx ====
// ==== File: frontend/src/main.tsx ====
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css'; // Ensure this path is correct
import App from './App'; // Ensure this path is correct

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Root container missing from HTML (expected #root)");
}

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

// ==== File: frontend/src/pages/CourseManagementPage.tsx ====
// ==== File: frontend/src/pages/CourseManagementPage.tsx ====
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getCourseById, publishCourseApi, deleteCourseApi } from '@/api/coursesApi';
import type { Course } from '@/types/Course';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CourseManagementPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<'' | 'publish' | 'delete'>('');

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setError("ID курса не указан.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const courseData = await getCourseById(courseId);
      setCourse(courseData);
      document.title = `${courseData.title || 'Курс'} - Управление - AI-Hunt`;
    } catch (err) {
      console.error("Error fetching course for management:", err);
      setError("Не удалось загрузить данные курса. " + (err instanceof Error ? err.message : ""));
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handlePublish = async () => {
    if (!course || !course.id || course.isPublished) return;
    setActionInProgress('publish');
    setError(null);
    try {
      const updatedCourse = await publishCourseApi(course.id);
      setCourse(updatedCourse);
    } catch (err) {
      setError("Ошибка публикации курса: " + (err instanceof Error ? err.message : "Проверьте, все ли поля курса заполнены."));
    } finally {
      setActionInProgress('');
    }
  };

  const handleDelete = async () => {
    if (!course || !course.id) return;
    if (window.confirm(`Вы уверены, что хотите удалить курс "${course.title}"? Это действие необратимо.`)) {
      setActionInProgress('delete');
      setError(null);
      try {
        await deleteCourseApi(course.id);
        navigate('/profile'); 
      } catch (err) {
        setError("Ошибка удаления курса: " + (err instanceof Error ? ((err as any).response?.data?.message || err.message) : "Неизвестная ошибка"));
      } finally {
        setActionInProgress('');
      }
    }
  };

  if (isAuthLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  }

  if (!user) { 
    navigate('/');
    return null;
  }
  
  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка курса...</p></div>;
  }

  if (error && !course) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">{error}</p><Link to="/profile" className="mt-4 btn-primary">Вернуться в профиль</Link></div>;
  }

  if (!course) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-gray-600 text-lg">Курс не найден.</p><Link to="/profile" className="mt-4 btn-primary">Вернуться в профиль</Link></div>;
  }

  if (course.authorId !== user.id) {
    return <div className="max-w-2xl mx-auto p-4 py-8 text-center"><p className="text-red-600 text-lg">У вас нет прав для управления этим курсом.</p><Link to="/" className="mt-4 btn-primary">На главную</Link></div>;
  }


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-6">
        <Link to="/profile" className="text-sm text-orange-600 hover:text-orange-700 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Назад в профиль (к моим курсам)
        </Link>
      </div>

      {error && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center" role="alert">{error}</div>}
      
      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        {course.coverUrl && (
          <img src={course.coverUrl} alt={course.title} className="w-full h-64 sm:h-72 md:h-80 object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-0">{course.title}</h1>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full self-start sm:self-center ${course.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {course.isPublished ? `Опубликован (Версия ${course.version || 1})` : 'Черновик'}
            </span>
          </div>

          {course.description && (
            <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 mb-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{course.description}</ReactMarkdown>
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-8">Статистика и информация</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 text-sm">
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Сложность</p>
              <p className="font-semibold text-gray-800">{course.difficulty || 'Не указана'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Язык</p>
              <p className="font-semibold text-gray-800">{course.language || 'Не указан'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Длительность</p>
              <p className="font-semibold text-gray-800">{course.estimatedDuration ? `${course.estimatedDuration} ч.` : 'Не указана'}</p>
            </div>
             <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Записей</p>
              <p className="font-semibold text-gray-800">{course.stats.enrollments}</p>
            </div>
             <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Средний рейтинг</p>
              <p className="font-semibold text-gray-800">{course.stats.avgRating > 0 ? course.stats.avgRating.toFixed(1) + '/5' : 'Нет оценок'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-gray-500">Уроков</p>
              <p className="font-semibold text-gray-800">{Array.isArray(course.lessons) ? course.lessons.length : 0}</p>
            </div>
          </div>
          
          <div className="border-t pt-6 flex flex-wrap justify-start gap-3">
            <Link to={`/courses/${course.id}/edit-facade`} className="btn-primary whitespace-nowrap">
              Редактировать
            </Link>
            {!course.isPublished && (
              <button 
                onClick={handlePublish} 
                disabled={actionInProgress === 'publish'}
                className="btn-success whitespace-nowrap"
              >
                {actionInProgress === 'publish' ? 'Публикация...' : 'Опубликовать курс'}
              </button>
            )}
            <button 
              onClick={handleDelete} 
              disabled={actionInProgress === 'delete'}
              className="btn-danger whitespace-nowrap md:ml-auto" 
            >
              {actionInProgress === 'delete' ? 'Удаление...' : 'Удалить курс'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseManagementPage;

// ==== File: frontend/src/pages/CreateCoursePage.tsx ====
// ==== File: frontend/src/pages/CreateCoursePage.tsx ====
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  createCourseFacade,
  uploadCourseCover,
  getAvailableTags,
  getCourseById,
  updateCourseFacade
} from '../api/coursesApi';
import type { CourseFacadePayload, Course } from '../types/Course';

const DIFFICULTY_TAG_OPTIONS: ReadonlyArray<'Beginner' | 'Middle' | 'Senior'> = ['Beginner', 'Middle', 'Senior'];
const COMMON_LANGUAGE_TAG_OPTIONS: Readonly<string[]> = [
  'Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'
];

interface FormDataState {
  title: string;
  description: string;
  selectedTags: string[];
  coverFile: File | null;
  estimatedDuration: string;
}

const initialFormData: FormDataState = {
  title: '',
  description: '',
  selectedTags: [],
  coverFile: null,
  estimatedDuration: '',
};

const CreateCoursePage: React.FC = () => {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const isEditMode = !!courseId;

  const [initialLoading, setInitialLoading] = useState<boolean>(isEditMode);
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [allAvailableSystemTags, setAllAvailableSystemTags] = useState<string[]>([]);
  const [isLoadingSystemTags, setIsLoadingSystemTags] = useState<boolean>(true);
  const [tagSearchTerm, setTagSearchTerm] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pageTitle = isEditMode ? 'Редактирование курса - AI-Hunt' : 'Создание нового курса - AI-Hunt';
    document.title = pageTitle;

    if (isEditMode && courseId) {
      setInitialLoading(true); setError(null);
      getCourseById(courseId)
        .then(courseData => {
          if (!courseData || !courseData.id) { throw new Error("Данные курса не получены или некорректны."); }
          setFormData({
            title: courseData.title || '', description: courseData.description || '',
            selectedTags: Array.isArray(courseData.tags) ? courseData.tags : [],
            coverFile: null, estimatedDuration: courseData.estimatedDuration?.toString() || '',
          });
          setCoverPreview(courseData.coverUrl || null);
        })
        .catch(err => { setError(`Не удалось загрузить курс (ID: ${courseId}). ` + (err.message || "")); navigate('/profile'); })
        .finally(() => setInitialLoading(false));
    } else {
      setFormData(initialFormData); setCoverPreview(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
      setError(null); setSuccessMessage(null); setInitialLoading(false);
    }
  }, [isEditMode, courseId, navigate]);

  useEffect(() => {
    setIsLoadingSystemTags(true);
    getAvailableTags()
      .then(tagsFromServer => {
        const uniqueTags = new Set([...DIFFICULTY_TAG_OPTIONS, ...COMMON_LANGUAGE_TAG_OPTIONS, ...tagsFromServer.map(t => t.trim()).filter(Boolean)]);
        setAllAvailableSystemTags(Array.from(uniqueTags).sort());
      })
      .catch(err => { setError("Не удалось загрузить системные теги."); setAllAvailableSystemTags([...DIFFICULTY_TAG_OPTIONS, ...COMMON_LANGUAGE_TAG_OPTIONS].sort()); })
      .finally(() => setIsLoadingSystemTags(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null); setSuccessMessage(null);
  };

  const handleTagToggle = (tagToToggle: string) => {
    setFormData(prev => {
      let newSelectedTags = prev.selectedTags ? [...prev.selectedTags] : [];
      const isDifficultyTag = DIFFICULTY_TAG_OPTIONS.includes(tagToToggle as any);
      if (newSelectedTags.includes(tagToToggle)) {
        newSelectedTags = newSelectedTags.filter(t => t !== tagToToggle);
      } else {
        if (isDifficultyTag) { newSelectedTags = newSelectedTags.filter(t => !DIFFICULTY_TAG_OPTIONS.includes(t as any)); }
        newSelectedTags.push(tagToToggle);
      }
      return { ...prev, selectedTags: newSelectedTags };
    });
    setError(null); setSuccessMessage(null);
  };

  const handleAddCustomTag = () => {
    const newTag = customTagInput.trim();
    if (newTag && !formData.selectedTags.includes(newTag) && !allAvailableSystemTags.includes(newTag)) {
        setFormData(prev => ({...prev, selectedTags: [...(prev.selectedTags || []), newTag]}));
    }
    setCustomTagInput(''); setError(null); setSuccessMessage(null);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setError('Файл должен быть изображением.'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      if (file.size > 5 * 1024 * 1024) { setError('Файл слишком большой (макс. 5MB).'); setCoverPreview(null); setFormData(p => ({...p, coverFile: null})); if (coverInputRef.current) coverInputRef.current.value = ""; return; }
      setError(null); setFormData(prev => ({ ...prev, coverFile: file }));
      if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setFormData(prev => ({ ...prev, coverFile: null }));
      if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    }
    setError(null); setSuccessMessage(null);
  };
  useEffect(() => { return () => { if (coverPreview && coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview); }; }, [coverPreview]);

  const handleSubmitFacade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Необходима авторизация.'); return; }
    if (!formData.title.trim() || !formData.description.trim()) { setError('Название и описание обязательны.'); return; }
    const selectedDifficulty = formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any));
    if (!selectedDifficulty) { setError('Выберите один тег сложности (Beginner, Middle, Senior).'); return; }
    setIsSubmitting(true); setError(null); setSuccessMessage(null);
    try {
      let finalCoverUrl: string | null | undefined = coverPreview;
      if (formData.coverFile) {
        const coverFormData = new FormData(); coverFormData.append('avatar', formData.coverFile);
        const uploadResponse = await uploadCourseCover(coverFormData); finalCoverUrl = uploadResponse.coverUrl;
      } else if (coverPreview === null && isEditMode) { finalCoverUrl = null; }
      const durationStr = formData.estimatedDuration.trim();
      const duration = durationStr ? parseInt(durationStr, 10) : undefined;
      if (durationStr && (isNaN(duration!) || duration! < 0)) {
        setError("Длительность должна быть положительным числом или пустой."); setIsSubmitting(false); return;
      }
      const payload: CourseFacadePayload = {
        title: formData.title.trim(), description: formData.description.trim(),
        tags: formData.selectedTags, coverUrl: finalCoverUrl, estimatedDuration: duration,
      };
      let resultingCourse: Course;
      if (isEditMode && courseId) {
        resultingCourse = await updateCourseFacade(courseId, payload);
        setSuccessMessage(`Курс "${resultingCourse.title}" успешно обновлен!`);
        setFormData(prev => ({
            ...prev, title: resultingCourse.title || '', description: resultingCourse.description || '',
            selectedTags: Array.isArray(resultingCourse.tags) ? resultingCourse.tags : [],
            coverFile: null, estimatedDuration: resultingCourse.estimatedDuration?.toString() || '',
        }));
        setCoverPreview(resultingCourse.coverUrl || null);
        setTimeout(() => { setSuccessMessage(null); }, 3000);
      } else {
        resultingCourse = await createCourseFacade(payload);
        setSuccessMessage(`Курс "${resultingCourse.title}" создан! Перенаправление к урокам...`);
        if (resultingCourse && resultingCourse.id) {
          setTimeout(() => { navigate(`/courses/${resultingCourse.id}/edit-content`); }, 2000);
        } else {
            setError("Не удалось получить ID созданного курса. Попробуйте сохранить еще раз.");
            console.error("CreateCoursePage: resultingCourse or ID is missing", resultingCourse);
        }
      }
    } catch (err) {
      const errorMsg = (err instanceof Error) ? err.message : 'Ошибка при сохранении курса.';
      setError((err as any).response?.data?.message || errorMsg);
    } finally { setIsSubmitting(false); }
  };

  const filteredSystemTags = useMemo(() => {
    const lowerSearch = tagSearchTerm.toLowerCase().trim();
    const currentSelectedTags = Array.isArray(formData.selectedTags) ? formData.selectedTags : [];
    const availableToShow = allAvailableSystemTags.filter(tag => !currentSelectedTags.includes(tag));
    if (!lowerSearch) { return availableToShow.slice(0, 20); } // Показываем до 20 тегов, если поиск пуст
    return availableToShow.filter(tag => tag.toLowerCase().includes(lowerSearch));
  }, [tagSearchTerm, allAvailableSystemTags, formData.selectedTags]);

  const isSubmitDisabled = isSubmitting || !formData.title.trim() || !formData.description.trim() || !(Array.isArray(formData.selectedTags) && formData.selectedTags.find(tag => DIFFICULTY_TAG_OPTIONS.includes(tag as any)));

  if (initialLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Редактирование курса' : 'Создание курса'}
        </h1>
        {isEditMode && (
          <Link to="/create-course" className="btn-outline text-sm">
            Создать новый курс
          </Link>
        )}
      </div>

      {error && <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center" role="alert">{error}</div>}
      {successMessage && <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center" role="alert">{successMessage}</div>}

      <form onSubmit={handleSubmitFacade} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-gray-200 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Название курса <span className="text-red-500">*</span></label>
          <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required className="form-input" placeholder="Основы Go для начинающих"/>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Описание <span className="text-red-500">*</span></label>
          <textarea name="description" id="description" rows={4} value={formData.description} onChange={handleChange} required className="form-textarea" placeholder="Подробное описание..."/>
        </div>
        <div>
          <label htmlFor="coverFile" className="block text-sm font-medium text-gray-700 mb-1">Обложка (16:9, до 5MB)</label>
          <input type="file" name="coverFile" id="coverFile" accept="image/*" onChange={handleCoverChange} ref={coverInputRef} className="form-file-input"/>
          {coverPreview && (
            <div className="mt-3 relative group w-fit max-w-xs">
                <img src={coverPreview} alt="Предпросмотр" className="max-h-48 w-full object-contain rounded-md shadow-sm border"/>
                {isEditMode && coverPreview && (
                    <button type="button" onClick={() => { setCoverPreview(null); setFormData(prev => ({...prev, coverFile: null})); if(coverInputRef.current) coverInputRef.current.value = ""; }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            title="Удалить обложку">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="estimatedDuration" className="block text-sm font-medium text-gray-700 mb-1">Примерная длительность (часов)</label>
          <input type="number" name="estimatedDuration" id="estimatedDuration" value={formData.estimatedDuration} onChange={handleChange} className="form-input w-32" placeholder="20" min="0"/>
        </div>

        {/* ВОССТАНОВЛЕННАЯ СЕКЦИЯ ТЕГОВ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Теги курса <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-500 mb-2">Выберите уровень сложности (обязательно), язык (если применимо) и другие релевантные теги.</p>
          {Array.isArray(formData.selectedTags) && formData.selectedTags.length > 0 && (
            <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50 flex flex-wrap gap-2">
              {formData.selectedTags.map(tag => (
                <button type="button" key={`selected-${tag}`} onClick={() => handleTagToggle(tag)}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-600 text-white border border-orange-700 hover:bg-orange-700 flex items-center">
                  {tag}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <input type="text" placeholder="Поиск по системным тегам..." value={tagSearchTerm} onChange={(e) => setTagSearchTerm(e.target.value)} className="form-input mb-2" />
          {isLoadingSystemTags ? ( <p className="text-xs text-gray-500">Загрузка тегов...</p> ) : (
            filteredSystemTags.length > 0 ? (
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 flex flex-wrap gap-1.5 mb-2">
                {filteredSystemTags.map(tag => (
                  <button type="button" key={`suggest-${tag}`} onClick={() => handleTagToggle(tag)}
                          className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300">
                    #{tag}
                  </button>
                ))}
              </div>
            ) : ( tagSearchTerm && <p className="text-xs text-gray-500 mb-2">Теги по запросу "{tagSearchTerm}" не найдены.</p> )
          )}
          <div className="flex gap-2 items-center">
            <input type="text" placeholder="Добавить свой тег (например, React)" value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); }}}
                   className="form-input flex-grow"/>
            <button type="button" onClick={handleAddCustomTag} className="btn-secondary text-sm px-3 py-2 whitespace-nowrap">Добавить тег</button>
          </div>
        </div>
        {/* КОНЕЦ СЕКЦИИ ТЕГОВ */}

        <div className="pt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEditMode && courseId ? `/courses/${courseId}/edit-content` : '/profile')}
            disabled={isSubmitting}
            className="btn-outline"
          >
            {isEditMode ? 'К урокам' : 'Отмена'}
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="btn-primary"
          >
            {isSubmitting ? 'Сохранение...' : (isEditMode ? 'Сохранить изменения' : 'Далее (к урокам)')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCoursePage;

// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
// ==== File: frontend/src/pages/EditCourseContentPage.tsx ====
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { getCourseById, updateCourseContent } from '@/api/coursesApi';
import type {
  Course, LessonEditable, LessonIdentifiable, LessonPage, Question,
  CourseContentUpdatePayload, LessonPayloadForBackend
} from '@/types/Course';
import { createNewLessonPage } from '@/types/Course';
import LessonItem, { AddLessonButtonPlaceholder } from '@/components/course_editor/LessonItem';
import ContextMenu from '@/components/course_editor/ContextMenu';
import PageTab, { AddPageButton } from '@/components/course_editor/PageTabs';
import PageEditor from '@/components/course_editor/PageEditor';
import ChoosePageTypeModal from '@/components/course_editor/modals/ChoosePageTypeModal';
import { v4 as uuidv4 } from 'uuid';

const PencilSquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

const EditCourseContentPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonEditable[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [lessonTitleInput, setLessonTitleInput] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lessonId: string } | null>(null);
  const [isDndLessonsReady, setIsDndLessonsReady] = useState(false);
  const [isPageTypeModalOpen, setIsPageTypeModalOpen] = useState(false);

  const [showSaveFeedback, setShowSaveFeedback] = useState(false);
  const saveFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- DEBUGGING ---
  console.log(`%cRENDER EditCourseContentPage | Selected Lesson: ${selectedLessonId} | Selected Page: ${selectedPageId}`, "color: dodgerblue");

  useEffect(() => {
    if (!courseId) {
      setPageError("ID курса не указан в URL."); setIsLoading(false); navigate('/'); return;
    }
    document.title = `Редактор: Загрузка... - AI-Hunt`;
    setIsLoading(true); setPageError(null); setIsDndLessonsReady(false);
    getCourseById(courseId)
      .then(data => {
        if (!data || !data.id) { throw new Error("Курс не найден или данные некорректны."); }
        setCourse(data);
        const courseLessons = (data.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id, title: l.title, description: l.description,
                sort_order: l.sort_order ?? (l as any).sortOrder ?? 0,
                pages: (l.pages || []).map(p => ({
                    ...p,
                    content: p.content || '',
                    questions: (p.questions || []).map(q => ({
                        ...q,
                        options: q.options || []
                    })).sort((a,b) => a.sort_order - b.sort_order)
                })).sort((a,b) => a.sort_order - b.sort_order)
            }))
            .sort((a, b) => a.sort_order - b.sort_order);
        setLessons(courseLessons);
        document.title = `Редактор: ${data.title || 'Курс'} - AI-Hunt`;
        setIsDndLessonsReady(true);
      })
      .catch(err => {
        console.error("Error fetching course for editing:", err);
        setPageError(`Не удалось загрузить курс (ID: ${courseId}). ` + (err.message || ""));
        document.title = `Ошибка загрузки - AI-Hunt`;
      })
      .finally(() => setIsLoading(false));
  }, [courseId, navigate]);

  useEffect(() => {
    console.log('%cEFFECT: Initial Lesson/Page Selection | Lessons Populated:', "color: green", lessons.length > 0, '| Current Selected Lesson:', selectedLessonId);
    if (lessons.length > 0 && !selectedLessonId) {
        const firstLesson = lessons[0];
        console.log('%cEFFECT: Setting initial selected lesson:', "color: green", firstLesson.id);
        setSelectedLessonId(firstLesson.id);
        // Page selection will be handled by the next effect if this updates selectedLessonId
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (selectedLessonId) {
      const selected = lessons.find(l => l.id === selectedLessonId);
      setLessonTitleInput(selected?.title || '');
    } else { setLessonTitleInput(''); }
  }, [selectedLessonId, lessons]);

  useEffect(() => {
    console.log(`%cEFFECT: Page Selection | Selected Lesson: ${selectedLessonId} | Current Selected Page: ${selectedPageId} | Lessons count: ${lessons.length}`, "color: purple");
    if (selectedLessonId) {
      const currentLesson = lessons.find(l => l.id === selectedLessonId);
      console.log('%cEFFECT: Page Selection | Found current lesson:', "color: purple", currentLesson);
      if (currentLesson) {
        if (currentLesson.pages.length > 0) {
          const isCurrentPageStillValid = currentLesson.pages.some(p => p.id === selectedPageId);
          if (!isCurrentPageStillValid) {
            console.log('%cEFFECT: Page Selection | Current page invalid or not set, selecting first page:', "color: purple", currentLesson.pages[0].id);
            setSelectedPageId(currentLesson.pages[0].id);
          } else {
            console.log('%cEFFECT: Page Selection | Current page is valid, keeping selection.', "color: purple");
          }
        } else {
          console.log('%cEFFECT: Page Selection | Current lesson has no pages, setting selectedPageId to null.', "color: purple");
          setSelectedPageId(null);
        }
      } else {
         console.log('%cEFFECT: Page Selection | SelectedLessonId is set, but lesson not found in lessons array (should not happen). Setting selectedPageId to null.', "color: red");
         setSelectedPageId(null);
      }
    } else {
      console.log('%cEFFECT: Page Selection | No lesson selected, setting selectedPageId to null.', "color: purple");
      setSelectedPageId(null);
    }
  }, [selectedLessonId, lessons]); // Removed selectedPageId to prevent potential loops if it's the only thing changing this effect

  const handleAddLesson = useCallback((afterLessonId?: string) => {
    const newLesson: LessonEditable = {
        id: `temp-${uuidv4()}`, title: 'Новый урок', description: '', sort_order: 0, pages: []
    };
    setLessons(prevLessons => {
      let newArr = [...prevLessons];
      let insertAtIndex = prevLessons.length;
      if (afterLessonId) {
        const index = prevLessons.findIndex(l => l.id === afterLessonId);
        if (index !== -1) insertAtIndex = index + 1;
      }
      newArr.splice(insertAtIndex, 0, newLesson);
      return newArr.map((lesson, idx) => ({ ...lesson, sort_order: idx }));
    });
    setSelectedLessonId(newLesson.id);
    setSuccessMessage(null); setPageError(null);
  }, []);

  const handleDeleteLesson = useCallback((lessonIdToDelete: string) => {
    setLessons(prevLessons => {
        const newArr = prevLessons.filter(l => l.id !== lessonIdToDelete).map((l, i) => ({...l, sort_order: i}));
        if (selectedLessonId === lessonIdToDelete) {
            const newSelectedLesson = newArr.length > 0 ? newArr[0] : null;
            setSelectedLessonId(newSelectedLesson ? newSelectedLesson.id : null);
        }
        return newArr;
    });
    setSuccessMessage(null); setPageError(null);
  }, [selectedLessonId]);

  const handleLessonTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setLessonTitleInput(e.target.value);

  const applyCurrentLessonTitleChanges = useCallback(() => {
    if (selectedLessonId) {
      setLessons(prevLessons =>
        prevLessons.map(l =>
          l.id === selectedLessonId ? { ...l, title: lessonTitleInput.trim() || "Урок без названия" } : l
        )
      );
    }
  }, [selectedLessonId, lessonTitleInput]);

  const handleLessonTitleBlur = applyCurrentLessonTitleChanges;
  const handleLessonTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCurrentLessonTitleChanges(); (e.target as HTMLInputElement).blur(); }
  };

  const handleAddPageOptimistic = (type: 'METHODICAL' | 'ASSIGNMENT') => {
    console.log(`%chandleAddPageOptimistic called with type: ${type}, selectedLessonId: ${selectedLessonId}`, "color: orange; font-weight: bold;");
    if (!selectedLessonId) {
        console.error("handleAddPageOptimistic: No lesson selected!");
        return;
    }
    const currentLessonForPageAdd = lessons.find(l => l.id === selectedLessonId);
    if (!currentLessonForPageAdd) {
        console.error(`handleAddPageOptimistic: Could not find lesson with ID ${selectedLessonId}`);
        return;
    }

    const newPage = createNewLessonPage(type, currentLessonForPageAdd.pages.length);
    console.log(`%chandleAddPageOptimistic: New page created:`, "color: orange;", newPage);

    setLessons(prevLessons => {
        console.log(`%chandleAddPageOptimistic: Updating lessons state. Prev lesson pages count for ${selectedLessonId}: ${prevLessons.find(l=>l.id===selectedLessonId)?.pages.length}`, "color: orange;");
        const newLessonsState = prevLessons.map(l => {
            if (l.id === selectedLessonId) {
                const updatedPages = [...l.pages, newPage].map((p, i) => ({...p, sort_order: i}));
                console.log(`%chandleAddPageOptimistic: Lesson ${l.id} updated. New pages array:`, "color: orange;", updatedPages);
                return { ...l, pages: updatedPages };
            }
            return l;
        });
        console.log(`%chandleAddPageOptimistic: Full new lessons state:`, "color: orange;", newLessonsState);
        return newLessonsState;
    });
    console.log(`%chandleAddPageOptimistic: Setting selectedPageId to: ${newPage.id}`, "color: orange; font-weight: bold;");
    setSelectedPageId(newPage.id);
  };

  const handleDeletePage = (pageIdToDelete: string) => {
    if (!selectedLessonId) return;
    setLessons(prevLessons => prevLessons.map(l => {
        if (l.id === selectedLessonId) {
            const remainingPages = l.pages.filter(p => p.id !== pageIdToDelete).map((p, i) => ({...p, sort_order: i}));
            if (selectedPageId === pageIdToDelete) {
                setSelectedPageId(remainingPages.length > 0 ? remainingPages[0].id : null);
            }
            return { ...l, pages: remainingPages };
        }
        return l;
    }));
  };
  
  const handlePageTitleChange = (pageId: string, newTitle: string) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, title: newTitle} : p) };
        }
        return l;
    }));
  };

  const handlePageContentChange = (pageId: string, newContent: string) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, content: newContent} : p) };
        }
        return l;
    }));
  };

  const handlePageQuestionsChange = (pageId: string, newQuestions: Question[]) => {
    setLessons(prev => prev.map(l => {
        if (l.id === selectedLessonId) {
            return { ...l, pages: l.pages.map(p => p.id === pageId ? {...p, questions: newQuestions} : p) };
        }
        return l;
    }));
  };

  const onLessonDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;
    setLessons(prevLessons => {
        const items = Array.from(prevLessons);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        return items.map((lesson, index) => ({ ...lesson, sort_order: index }));
    });
    setSuccessMessage(null); setPageError(null);
  };

  const onPageDragEnd = (result: DropResult) => {
    if (!selectedLessonId || !result.destination) return;
    const { source, destination } = result;
     if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    setLessons(prevLessons => prevLessons.map(l => {
        if (l.id === selectedLessonId) {
            const pagesArray = Array.from(l.pages);
            const [reorderedPage] = pagesArray.splice(source.index, 1);
            pagesArray.splice(destination.index, 0, reorderedPage);
            return { ...l, pages: pagesArray.map((page, index) => ({ ...page, sort_order: index })) };
        }
        return l;
    }));
  };

  const handleContextMenu = (event: React.MouseEvent, lessonId: string) => {
    event.preventDefault(); setSelectedLessonId(lessonId);
    setContextMenu({ x: event.clientX, y: event.clientY, lessonId });
  };
  const closeContextMenu = () => setContextMenu(null);

  const handleSaveChanges = useCallback(async () => {
    if (!courseId || !course) { setPageError("Курс не загружен."); return; }
    applyCurrentLessonTitleChanges(); 

    setIsSaving(true); setPageError(null); 

    const lessonsToSave: LessonPayloadForBackend[] = lessons.map((lesson, lessonIndex) => ({
      title: lesson.title,
      description: lesson.description,
      sort_order: lessonIndex,
      pages: lesson.pages.map((page, pageIndex) => ({
        title: page.title,
        page_type: page.page_type,
        sort_order: pageIndex,
        content: page.content || '', 
        questions: page.questions.map((q, questionIndex) => {
          // Ensure correct_answer is either a string or null in the payload
          let finalCorrectAnswer: string | null = null;
          if (typeof q.correct_answer === 'string' && q.correct_answer.trim() !== '') {
            finalCorrectAnswer = q.correct_answer;
          } else if (q.correct_answer === '') { // Allow sending empty string if explicitly set
            finalCorrectAnswer = '';
          }
          // Any other case (undefined, null but not empty string) will default to null

          // console.log(`[FRONTEND PAYLOAD] Question ${q.id} correct_answer being sent: '${finalCorrectAnswer}' (original was: '${q.correct_answer}')`);

          return {
            text: q.text,
            type: q.type,
            correct_answer: finalCorrectAnswer, 
            sort_order: questionIndex,
            options: q.options.map((opt, optionIndex) => ({
              label: opt.label,
              is_correct: opt.is_correct,
              sort_order: optionIndex,
            }))
          };
        })
      }))
    }));

    const payload: CourseContentUpdatePayload = { lessons: lessonsToSave };

    try {
        const updatedCourseFromApi = await updateCourseContent(courseId, payload);
        const backendLessons = (updatedCourseFromApi.lessons as LessonEditable[] || [])
            .map(l => ({
                id: l.id, title: l.title, description: l.description,
                sort_order: l.sort_order ?? (l as any).sortOrder ?? 0,
                pages: (l.pages || []).map(p => ({
                    ...p,
                    content: p.content || '',
                    questions: (p.questions || []).map(q => ({
                        ...q, 
                        correct_answer: q.correct_answer || '',
                        options: q.options || []
                    })).sort((a,b) => a.sort_order - b.sort_order)
                })).sort((a,b) => a.sort_order - b.sort_order)
            }))
            .sort((a, b) => a.sort_order - b.sort_order);

        // --- DEBUG BEFORE SETTING STATE ---
        console.log("%cSave Success: Received from API (updatedCourseFromApi.lessons):", "color: blue", updatedCourseFromApi.lessons);
        console.log("%cSave Success: Processed backendLessons:", "color: blue", backendLessons);
        console.log(`%cSave Success: Old selectedLessonId: ${selectedLessonId}, Old selectedPageId: ${selectedPageId}`, "color: blue");
        // ---

        const oldSelectedLessonId = selectedLessonId;
        const oldSelectedPageId = selectedPageId;
        let oldLessonIndex = -1;
        if (oldSelectedLessonId) {
             oldLessonIndex = lessons.findIndex(l => l.id === oldSelectedLessonId);
        }
        let oldPageIndex = -1;
        if (oldLessonIndex !== -1 && oldSelectedPageId) {
            oldPageIndex = lessons[oldLessonIndex].pages.findIndex(p => p.id === oldSelectedPageId);
        }

        setLessons(backendLessons);
        setCourse(updatedCourseFromApi); // Update the course itself if needed

        setShowSaveFeedback(true);
        if (saveFeedbackTimeoutRef.current) {
            clearTimeout(saveFeedbackTimeoutRef.current);
        }
        saveFeedbackTimeoutRef.current = setTimeout(() => {
            setShowSaveFeedback(false);
        }, 2000);

        let newSelectedLessonId: string | null = null;
        if (oldLessonIndex !== -1 && backendLessons[oldLessonIndex]) {
            newSelectedLessonId = backendLessons[oldLessonIndex].id;
        } else if (backendLessons.length > 0) {
            newSelectedLessonId = backendLessons[0].id;
        }
        setSelectedLessonId(newSelectedLessonId);
        console.log(`%cSave Success: New selectedLessonId: ${newSelectedLessonId}`, "color: blue");

        if (newSelectedLessonId) {
            const newSelectedLessonData = backendLessons.find(l => l.id === newSelectedLessonId);
            let newSelectedPageIdToSet: string | null = null;
            if (newSelectedLessonData) {
                if (oldPageIndex !== -1 && newSelectedLessonData.pages[oldPageIndex]) {
                    newSelectedPageIdToSet = newSelectedLessonData.pages[oldPageIndex].id;
                } else if (newSelectedLessonData.pages.length > 0) {
                    newSelectedPageIdToSet = newSelectedLessonData.pages[0].id;
                }
            }
            setSelectedPageId(newSelectedPageIdToSet);
            console.log(`%cSave Success: New selectedPageIdToSet: ${newSelectedPageIdToSet}`, "color: blue");
        } else {
            setSelectedPageId(null);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
        console.error("Error saving course content:", err);
        const apiErrorMessage = (err as any).response?.data?.message;
        setPageError("Ошибка при сохранении уроков: " + (apiErrorMessage || (err as Error).message || "Неизвестная ошибка"));
    } finally {
        setIsSaving(false);
    }
  }, [courseId, course, lessons, selectedLessonId, selectedPageId, lessonTitleInput, applyCurrentLessonTitleChanges]);

  const currentLesson = useMemo(() => {
    const lesson = lessons.find(l => l.id === selectedLessonId);
    console.log(`%cMEMO currentLesson | selectedLessonId: ${selectedLessonId} | found:`, "color: teal", lesson);
    return lesson;
  }, [lessons, selectedLessonId]);

  const currentPage = useMemo(() => {
    const page = currentLesson?.pages.find(p => p.id === selectedPageId);
    console.log(`%cMEMO currentPage | selectedPageId: ${selectedPageId} | found in currentLesson:`, "color: teal", page);
    return page;
  }, [currentLesson, selectedPageId]);

  if (isLoading) { return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div><p className="ml-3">Загрузка редактора...</p></div>; }
  if (pageError && !course) { return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><h2 className="text-2xl font-semibold text-red-600 mb-4">Ошибка</h2><p className="text-gray-700 mb-6">{pageError}</p><Link to="/profile" className="btn-primary">В профиль</Link></div>;}
  if (!course) { return <div className="flex justify-center items-center min-h-screen"><p>Загрузка...</p></div>; }

  return (
    <div className={`flex h-[calc(100vh-4rem)] bg-gray-100 text-gray-800 transition-all duration-500 ease-in-out ${showSaveFeedback ? 'outline outline-4 outline-green-500 outline-offset-[-4px]' : 'outline-none'}`}>
      {/* Lessons Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center min-h-[65px]">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-2" title={course.title}>
            {course.title}
          </h2>
          <Link to={`/courses/${course.id}/edit-facade`} title="Редактировать информацию о курсе" className="p-1.5 text-gray-500 hover:text-orange-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500">
            <PencilSquareIcon className="w-5 h-5" />
          </Link>
        </div>
        <div className="flex-grow overflow-y-auto p-3 custom-scrollbar">
          {isDndLessonsReady ? (
            <DragDropContext onDragEnd={onLessonDragEnd}>
              <Droppable droppableId="lessonsList" type="LESSON">
                {(provided, snapshot) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className={`min-h-full pb-1 ${snapshot.isDraggingOver ? 'bg-orange-50' : ''}`}>
                    {lessons.map((lesson, index) => (
                      <Draggable key={lesson.id} draggableId={lesson.id} index={index}>
                        {(providedDraggable, snapshotDraggable) => (
                          <LessonItem lesson={lesson} index={index} provided={providedDraggable} snapshot={snapshotDraggable} onSelectLesson={setSelectedLessonId} onContextMenu={handleContextMenu} isSelected={selectedLessonId === lesson.id} />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <div className="mt-2"> <AddLessonButtonPlaceholder onClick={() => handleAddLesson()} /> </div>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (<p className="p-4 text-sm text-gray-500 text-center">Загрузка уроков...</p>)}
        </div>
        <div className="p-3 border-t border-gray-200 mt-auto">
          <button onClick={handleSaveChanges} disabled={isSaving || isLoading || !isDndLessonsReady} className="w-full btn-primary py-2.5 text-sm">
            {isSaving ? ( <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div> Сохранение...</> ) 
                      : showSaveFeedback ? "Сохранено!" 
                      : "Сохранить структуру"}
          </button>
        </div>
        {contextMenu && ( <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} onDelete={() => { handleDeleteLesson(contextMenu.lessonId); closeContextMenu(); }} onAddAfter={() => { handleAddLesson(contextMenu.lessonId); closeContextMenu(); }} /> )}
      </div>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col p-0 overflow-hidden">
        {pageError && !successMessage && <div className="m-4 p-3 bg-red-100 text-red-700 rounded-md text-sm shadow" role="alert">{pageError}</div>}

        {selectedLessonId && currentLesson ? (
            <>
                <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 shadow-sm">
                    <div className="mb-3">
                        <label htmlFor="lessonTitleInputMain" className="block text-xs font-medium text-gray-500 mb-0.5">Название урока (в списке слева)</label>
                        <input id="lessonTitleInputMain" type="text" value={lessonTitleInput} onChange={handleLessonTitleChange} onBlur={handleLessonTitleBlur} onKeyDown={handleLessonTitleKeyDown} placeholder="Название урока" className="form-input w-full sm:w-2/3 lg:w-1/2 text-lg py-1.5" />
                    </div>
                    <div className="flex items-center overflow-x-auto pb-1 custom-scrollbar-thin">
                        <DragDropContext onDragEnd={onPageDragEnd}>
                            <Droppable droppableId={`pages-${selectedLessonId}`} direction="horizontal" type="PAGE">
                                {(providedDroppable) => (
                                    <div ref={providedDroppable.innerRef} {...providedDroppable.droppableProps} className="flex items-center">
                                        {currentLesson.pages.map((page, index) => (
                                        <Draggable key={page.id} draggableId={page.id} index={index}>
                                            {(providedDraggable, snapshotDraggable) => (
                                                <PageTab page={page} index={index} provided={providedDraggable} snapshot={snapshotDraggable} isSelected={selectedPageId === page.id} onSelectPage={setSelectedPageId} onDeletePage={handleDeletePage}/>
                                            )}
                                        </Draggable>
                                        ))}
                                        {providedDroppable.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                        <AddPageButton onClick={() => setIsPageTypeModalOpen(true)} />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    {currentLesson.pages.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300"> <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0a3.375 3.375 0 0 0-3.375 3.375M19.5 0v.75Q19.5 3.75 16.5 3.75h-2.25V1.5" transform="translate(0 6)"/> <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> </svg>
                            <p className="text-base">В этом уроке пока нет страниц.</p>
                            <p className="text-sm mt-1">Нажмите "+" выше, чтобы добавить страницу.</p>
                        </div>
                    ) : selectedPageId && currentPage ? (
                        <PageEditor
                            page={currentPage}
                            onPageTitleChange={handlePageTitleChange}
                            onContentChange={handlePageContentChange}
                            onQuestionsChange={handlePageQuestionsChange}
                        />
                    ) : currentLesson.pages.length > 0 ? ( 
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <p className="text-base">Выберите страницу из списка выше для редактирования.</p>
                        </div>
                    ) : null } 
                </div>
            </>
        ) : lessons.length > 0 && isDndLessonsReady ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"> <p className="text-base">Выберите урок из списка слева для редактирования.</p> </div>
        ) : isDndLessonsReady && lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300"> <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> </svg>
                <p className="text-base">У этого курса пока нет уроков.</p> <p className="text-sm mt-1">Нажмите "+" в списке слева, чтобы добавить.</p>
            </div>
        ) : null }
      </main>
      <ChoosePageTypeModal
        isOpen={isPageTypeModalOpen}
        onClose={() => setIsPageTypeModalOpen(false)}
        onSelectType={(type) => {
            console.log(`%cModal onSelectType: ${type}`, "color: fuchsia;");
            handleAddPageOptimistic(type);
            setIsPageTypeModalOpen(false);
        }}
      />
    </div>
  );
};

export default EditCourseContentPage;

// ==== File: frontend/src/pages/EditProfilePage.tsx ====
// ==== File: frontend/src/pages/EditProfilePage.tsx ====
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, uploadAvatar } from '../api/userApi'; // getCurrentUser removed if relying on useAuth
import type { User } from '../types/User';

const EditProfilePage: React.FC = () => {
  const { user: authUser, updateUserState, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Initialize form state directly from authUser if available
  const [fullName, setFullName] = useState<string>(authUser?.fullName || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(authUser?.avatarUrl || '/images/default-avatar.png');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Редактирование профиля - AI-Hunt';
    if (!isAuthLoading && !authUser) { // If auth check done and no user, redirect
        navigate('/profile'); // Or login
    }
    // Pre-fill form if authUser changes (e.g., after initial load)
    if (authUser) {
        setFullName(authUser.fullName || '');
        setAvatarPreview(authUser.avatarUrl || '/images/default-avatar.png');
    }
  }, [authUser, isAuthLoading, navigate]);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) { setProfileMessage({ text: 'Пожалуйста, выберите файл изображения.', type: 'error' }); return; }
      if (file.size > 5 * 1024 * 1024) { setProfileMessage({ text: 'Файл слишком большой (макс. 5MB).', type: 'error' }); return; }
      setProfileMessage(null);
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file)); // Show preview immediately
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setIsUpdatingProfile(true);
    setProfileMessage(null);
    let newAvatarUrl = authUser.avatarUrl; // Keep existing if no new file

    try {
      // 1. Upload avatar if a new one is selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        // uploadAvatar now returns the full updated user object with the new avatar URL
        const uploadResponse = await uploadAvatar(formData);
        newAvatarUrl = uploadResponse.avatarUrl; // Get the new URL
        updateUserState(uploadResponse.user); // Update auth state with user from avatar upload response
        setAvatarFile(null); // Clear the file input state
        // No need to call updateProfile again if avatar was the only change and backend handles it
        if (fullName.trim() === (uploadResponse.user.fullName || '').trim()) {
             setProfileMessage({ text: 'Аватар успешно обновлен!', type: 'success' });
             setTimeout(() => navigate('/profile'), 1500);
             setIsUpdatingProfile(false);
             return; // Exit if only avatar changed and it's handled
        }
      }

      // 2. Update full name if it changed
      const currentFullName = authUser.fullName || '';
      if (fullName.trim() !== currentFullName.trim() && fullName.trim() !== '') {
        const updatedUserFromProfile = await updateProfile({ fullName: fullName.trim() });
        updateUserState(updatedUserFromProfile); // Update global auth state
        setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
      } else if (!avatarFile) { // No avatar change, no name change
        setProfileMessage({ text: 'Нет изменений для сохранения.', type: 'success' });
      } else if (avatarFile && fullName.trim() === (authUser.fullName || '').trim()){ // Avatar changed, name didn't
         // This case is handled above if avatarFile was processed
      } else { // Avatar changed AND name changed
         setProfileMessage({ text: 'Профиль успешно обновлен!', type: 'success' });
      }


      setTimeout(() => navigate('/profile'), 1500);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      const apiErrorMsg = (error as any).response?.data?.message;
      setProfileMessage({ text: `Ошибка обновления: ${apiErrorMsg || errorMsg}`, type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancel = () => navigate('/profile');

  if (isAuthLoading && !authUser) {
    return (<div className="flex justify-center items-center min-h-[calc(100vh-150px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>);
  }
  if (!authUser) { // Should be caught by ProtectedRoute or initial useEffect
    return <div className="text-center py-12 text-lg">Пожалуйста, войдите для редактирования профиля.</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">Редактирование профиля</h1>
      {profileMessage && (
        <div className={`p-3 mb-6 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {profileMessage.text}
        </div>
      )}
      <form onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl border border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 sm:w-36 sm:h-36">
            <img src={avatarPreview || '/images/default-avatar.png'} alt="Аватар" className="w-full h-full object-cover rounded-full border-2 border-gray-300 shadow-sm"/>
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={isUpdatingProfile}
                    className="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full p-2 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow" title="Изменить аватар">
              <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={isUpdatingProfile}/>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
            </button>
          </div>
        </div>
        <div className="space-y-6 mb-8">
          <div>
            <label htmlFor="editFullName" className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
            <input id="editFullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isUpdatingProfile} className="form-input"/>
          </div>
          <div>
            <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">Электронная почта</label>
            <input id="editEmail" type="email" value={authUser.email} readOnly className="form-input bg-gray-100 text-gray-500 cursor-not-allowed"/>
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button type="button" onClick={handleCancel} disabled={isUpdatingProfile} className="btn-outline">Отмена</button>
          <button type="submit" disabled={isUpdatingProfile || (!avatarFile && fullName === (authUser.fullName || ''))} className="btn-primary">
            {isUpdatingProfile ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;

// ==== File: frontend/src/pages/HomePage.tsx ====
// ==== File: frontend/src/pages/HomePage.tsx ====
import React, { useEffect, useRef, useState } from 'react';
import HeroSection from '../components/HeroSection';
import SearchBar from '../components/SearchBar';
import CourseList from '../components/CourseList';
import { useCourses, CourseFilters, defaultCourseFilters } from '../hooks/useCourses';

// Assuming COMMON_LANGUAGE_TAG_OPTIONS is available or defined here/imported
const COMMON_LANGUAGE_TAG_OPTIONS: Readonly<string[]> = [
    'Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Русский', 'English'
];

const HomePage: React.FC = () => {
  // Initialize with defaultCourseFilters to ensure all filter fields are defined
  const { courses, loading, error, filters: currentActiveFilters, applyFilters } = useCourses(defaultCourseFilters);
  const catalogRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState(currentActiveFilters.search || '');

  useEffect(() => {
    document.title = 'AI-Hunt - Подготовка к IT собеседованиям';
  }, []);

  useEffect(() => {
    if (currentActiveFilters.search !== searchTerm) {
      setSearchTerm(currentActiveFilters.search || '');
    }
  }, [currentActiveFilters.search, searchTerm]); // Added searchTerm to deps to avoid potential stale closure issue

  const handleSearch = () => {
    applyFilters({
      ...defaultCourseFilters,
      sort: currentActiveFilters.sort || defaultCourseFilters.sort,
      search: searchTerm.trim(),
    });
  };

  const handleTagClick = (tag: string) => {
    setSearchTerm('');
    let newLevel: CourseFilters['level'] | undefined = undefined;
    let newLanguage: string | undefined = undefined;
    const otherTags: string[] = [];

    if (['Beginner', 'Middle', 'Senior'].includes(tag)) {
      newLevel = tag as CourseFilters['level'];
    } else if (COMMON_LANGUAGE_TAG_OPTIONS.includes(tag)) {
      newLanguage = tag;
    } else {
      otherTags.push(tag);
    }

    applyFilters({
      ...defaultCourseFilters,
      sort: currentActiveFilters.sort || defaultCourseFilters.sort,
      level: newLevel,
      language: newLanguage,
      tags: otherTags,
    });
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    applyFilters(defaultCourseFilters);
  };

  // console.log("HomePage rendering. Loading:", loading, "Error:", error, "Courses:", courses.length); // DEBUG

  return (
    <div>
      <HeroSection onTagClick={handleTagClick} />
      <div id="catalog" ref={catalogRef} className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
            Каталог курсов
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleSearch}
              placeholder="Поиск по названию, автору или тегам..."
            />
            <button
              onClick={handleResetFilters}
              className="btn-outline px-4 py-2.5 text-sm whitespace-nowrap" // Assuming btn-outline is defined
              title="Сбросить все фильтры и поиск"
            >
              Сбросить фильтры
            </button>
          </div>
          <div className="min-h-[300px]"> {/* Ensure this has a min height to be visible if CourseList content is delayed/empty */}
            <CourseList courses={courses} loading={loading} error={error} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

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
// ==== File: frontend/src/types/Course.ts ====
// ==== File: frontend/src/types/Course.ts ====
import { v4 as uuidv4 } from 'uuid';

export interface MethodicalPageContent {
  content: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  is_correct: boolean;
  sort_order: number;
}

export interface Question {
  id: string;
  page_id?: string;
  text: string; // Markdown
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT';
  correct_answer?: string | null; // NEW: For TEXT_INPUT and CODE_INPUT
  sort_order: number;
  options: QuestionOption[];
}

export interface LessonPage {
  id: string;
  lesson_id?: string;
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  content: string;
  questions: Question[];
}

export interface LessonEditable extends LessonIdentifiable {
    description?: string | null;
    pages: LessonPage[];
}

export interface LessonIdentifiable {
  id: string;
  title: string;
  sort_order: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  hasQuiz: boolean;
}

export interface CourseStats {
  enrollments: number;
  avgCompletion: number;
  avgRating: number;
}

export interface Course {
  id: string;
  authorId?: string;
  authorName: string;
  title: string;
  description?: string;
  coverUrl: string | null;
  estimatedDuration: number | null;
  version?: number;
  isPublished?: boolean;
  tags: string[];
  difficulty: 'Beginner' | 'Middle' | 'Senior' | null;
  language: string | null;
  stats: CourseStats;
  lessons: LessonSummary[] | LessonEditable[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseFacadePayload {
  title: string;
  description: string;
  tags: string[];
  coverUrl?: string | null;
  estimatedDuration?: number;
}

export interface QuestionOptionPayload {
  id?: string;
  label: string;
  is_correct: boolean;
  sort_order: number;
}
export interface QuestionPayload {
  id?: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_INPUT' | 'CODE_INPUT';
  correct_answer?: string | null; // NEW
  sort_order: number;
  options: QuestionOptionPayload[];
}
export interface LessonPagePayload {
  id?: string;
  title: string;
  page_type: 'METHODICAL' | 'ASSIGNMENT';
  sort_order: number;
  content: string;
  questions: QuestionPayload[];
}
export interface LessonPayloadForBackend {
    id?: string;
    title: string;
    description?: string | null;
    sort_order: number;
    pages: LessonPagePayload[];
}
export interface CourseContentUpdatePayload {
  lessons: LessonPayloadForBackend[];
  title?: string;
  description?: string;
  tags?: string[];
  coverUrl?: string | null;
  estimatedDuration?: number;
}

export const getDifficultyFromTags = (tags: string[]): 'Beginner' | 'Middle' | 'Senior' | null => {
  if (!tags) return null;
  if (tags.includes('Beginner')) return 'Beginner';
  if (tags.includes('Middle')) return 'Middle';
  if (tags.includes('Senior')) return 'Senior';
  return null;
};

const KNOWN_LANGUAGES = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'];
export const getLanguageFromTags = (tags: string[]): string | null => {
  if (!tags) return null;
  for (const tag of tags) {
    if (KNOWN_LANGUAGES.includes(tag)) {
      return tag;
    }
  }
  return null;
};

export const createNewLessonPage = (type: 'METHODICAL' | 'ASSIGNMENT', sortOrder: number): LessonPage => {
    return {
        id: `temp-${uuidv4()}`,
        title: type === 'METHODICAL' ? 'Новая страница' : 'Новое задание',
        page_type: type,
        sort_order: sortOrder,
        content: '',
        questions: [],
    };
};

export const createNewQuestion = (sortOrder: number): Question => {
    return {
        id: `temp-${uuidv4()}`,
        text: 'Новый вопрос...',
        type: 'TEXT_INPUT',
        correct_answer: '', // Default empty correct answer
        sort_order: sortOrder,
        options: [],
    };
};

export const createNewQuestionOption = (sortOrder: number): QuestionOption => {
    return {
        id: `temp-${uuidv4()}`,
        label: 'Новый вариант',
        is_correct: false,
        sort_order: sortOrder,
    };
};

// ==== File: frontend/src/types/User.ts ====
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

// ==== File: frontend/src/vite-env.d.ts ====
/// <reference types="vite/client" />


// ==== File: frontend/tailwind.config.js ====
// ==== File: frontend/tailwind.config.js ====
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
        keyframes: {
          marquee: {
            '0%': { transform: 'translateX(0%)' },
            '100%': { transform: 'translateX(-50%)' },
          },
          'marquee-reverse': {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(0%)' },
          }
        },
        animation: {
          'marquee-slow': 'marquee 120s linear infinite',
          'marquee-medium': 'marquee 110s linear infinite',
          'marquee-fast': 'marquee 90s linear infinite'
        },
        // Add typography theme customizations here
        typography: (theme) => ({
          DEFAULT: { // Applied with `prose` class
            css: {
              color: theme('colors.gray.700'),
              h1: {
                color: theme('colors.gray.900'),
                fontWeight: '800', // Extra-bold
                fontSize: theme('fontSize.2xl'), // Tailwind's 2xl by default
                marginTop: theme('spacing.6'),
                marginBottom: theme('spacing.3'),
              },
              h2: {
                color: theme('colors.gray.900'),
                fontWeight: '700',
                fontSize: theme('fontSize.xl'),
                marginTop: theme('spacing.5'),
                marginBottom: theme('spacing.2'),
              },
              h3: {
                color: theme('colors.gray.900'),
                fontWeight: '600',
                fontSize: theme('fontSize.lg'),
                marginTop: theme('spacing.4'),
                marginBottom: theme('spacing.2'),
              },
              // You can add more styles for p, a, strong, code, pre, etc.
              'code::before': { content: '""' }, // Remove default backticks for inline code
              'code::after': { content: '""' },
              code: {
                backgroundColor: theme('colors.gray.100'),
                padding: `${theme('spacing.1')} ${theme('spacing.1_5')}`,
                borderRadius: theme('borderRadius.md'),
                fontWeight: '500',
              },
              pre: {
                backgroundColor: theme('colors.gray.800'),
                color: theme('colors.gray.100'),
                padding: theme('spacing.4'),
                borderRadius: theme('borderRadius.lg'),
                overflowX: 'auto',
              },
              'pre code': { // Styles for code blocks within <pre>
                  backgroundColor: 'transparent',
                  padding: '0',
                  color: 'inherit',
                  fontWeight: 'normal',
              },
              a: {
                color: theme('colors.orange.600'),
                '&:hover': {
                  color: theme('colors.orange.700'),
                },
              },
            },
          },
          // Example of a larger prose style if needed: prose-lg
          lg: {
            css: {
              h1: { fontSize: theme('fontSize.3xl') }, // Larger H1 for prose-lg
              h2: { fontSize: theme('fontSize.2xl') },
              p:  { fontSize: theme('fontSize.lg'), lineHeight: theme('lineHeight.relaxed')},
            },
          },
        }),
      },
    },
    plugins: [
      require('@tailwindcss/line-clamp'),
      require('@tailwindcss/typography'), // Added typography plugin
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

