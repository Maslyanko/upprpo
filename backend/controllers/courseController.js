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

/**
 * Get all unique tags from published courses
 * @route GET /courses/tags
 */
const getAllTags = async (req, res) => {
  try {
    const tags = await Course.findAllUniqueTags();
    res.status(200).json(tags); // Send as a simple array of strings
  } catch (error) {
    console.error('Get all tags error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при получении тегов'
    });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  publishCourse,
  getAllTags // <-- ADDED EXPORT
};