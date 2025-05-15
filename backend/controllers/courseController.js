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