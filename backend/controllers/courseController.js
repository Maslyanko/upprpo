// ==== File: backend/controllers/courseController.js ====
const Course = require('../models/Course');
const Tag = require('../models/Tag'); // For fetching all tags
const db = require('../config/db'); // Import db for direct use if not passing client

/**
 * Get all courses with filtering
 * @route GET /courses
 */
const getCourses = async (req, res) => {
  try {
    const { search, difficulty, sort, tags, language } = req.query;
    const userId = req.user ? req.user.id : null;

    const tagsArray = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [];

    const filters = {
      search,
      difficulty, 
      sort,
      tags: tagsArray,
      language, 
    };

    const courses = await Course.findAll(filters, userId);
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
    const userId = req.user ? req.user.id : null;

    // Call Course.findById with userIdForProgress, dbClient will default in model
    const course = await Course.findById(courseId, version ? parseInt(version) : null, userId);

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

    const difficultyTag = courseData.tags?.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag));
    if (!difficultyTag) {
        return res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Необходимо указать тег сложности (Beginner, Middle, или Senior).'
        });
    }
    const newCourse = await Course.create({
        ...courseData,
        lessonsData: courseData.lessonsData || courseData.lessons || [] 
    }, authorId);
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

    if (updateData.tags) {
        const difficultyTag = updateData.tags.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag));
        // Validation for difficulty can be added here if needed
    }

    const updatedCourse = await Course.update(courseId, updateData, authorId);
    res.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Update course error:', error);
    if (error.message === 'Course not found or not authorized') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Вы не являетесь автором этого курса или курс не найден' });
    } else if (error.message === 'Not authorized to update this course') {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Вы не являетесь автором этого курса.' });
    } else if (error.message === 'Cannot update published course facade. Create a new version or unpublish first.') {
        return res.status(403).json({ code: 'ALREADY_PUBLISHED_FACADE_CHANGE', message: 'Нельзя изменять общую информацию опубликованного курса. Для изменения контента (уроков) версия обновится автоматически.' });
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
    const tagNames = await Tag.getUniqueCourseTagNames();
    res.status(200).json(tagNames); 
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
    await Course.deleteById(courseId, authorId); 
    res.status(204).send();
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