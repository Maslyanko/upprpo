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