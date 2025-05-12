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
    if (req.user.role !== 'author') {
       return res.status(403).json({
           code: 'FORBIDDEN',
           message: 'Доступно только авторам'
       });
    }

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