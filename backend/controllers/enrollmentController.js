// ==== File: backend/controllers/enrollmentController.js ====
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course'); // For checking course existence if needed

/**
 * Enroll in a course
 * @route POST /courses/:courseId/enroll
 */
const enrollCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const enrollmentResult = await Enrollment.enrollCourse(userId, courseId);
    if (enrollmentResult.alreadyEnrolled) {
        // If already enrolled, the model now returns existing data + a flag.
        // We can treat this as a success or a specific status code.
        // For simplicity, let's send 200 with the existing enrollment.
        return res.status(200).json({ 
            ...enrollmentResult, 
            message: 'Вы уже были записаны на этот курс.'
        });
    }
    res.status(201).json(enrollmentResult); // New enrollment
  } catch (error) {
    console.error('Enroll course error:', error);
    if (error.message === 'Already enrolled') { // This might be redundant if model handles it
      return res.status(409).json({ code: 'ALREADY_ENROLLED', message: 'Вы уже записаны на этот курс' });
    } else if (error.message === 'Course not found or not published') {
      return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: 'Курс не найден или не опубликован' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при записи на курс' });
  }
};

/**
 * Get enrollment progress for a specific course
 * @route GET /courses/:courseId/progress
 */
const getProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const progress = await Enrollment.getProgress(userId, courseId);
    if (!progress) {
      // This could mean not enrolled, or enrollment exists but something went wrong.
      // The `CourseTakingPage` will likely fetch the full course details first,
      // which would include lesson statuses if enrolled. This endpoint might be supplementary.
      return res.status(404).json({ code: 'ENROLLMENT_NOT_FOUND', message: 'Вы не записаны на этот курс или нет данных о прогрессе.' });
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
    const { value, comment } = req.body; 
    const userId = req.user.id;

    if (!value || value < 1 || value > 5) {
      return res.status(400).json({ code: 'INVALID_RATING', message: 'Оценка должна быть от 1 до 5' });
    }

    const rating = await Enrollment.rateCourse(userId, courseId, value, comment);
    res.status(201).json(rating);
  } catch (error) {
    console.error('Rate course error:', error);
    if (error.message === 'Not enrolled in the course') {
      return res.status(403).json({ code: 'NOT_ENROLLED', message: 'Вы не записаны на этот курс, чтобы его оценивать.' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при оценке курса' });
  }
};

/**
 * Mark a lesson as complete
 * @route POST /lessons/:lessonId/complete
 */
const completeLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const result = await Enrollment.markLessonComplete(userId, lessonId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Complete lesson error:', error);
    if (error.message === 'Lesson not found.') {
        return res.status(404).json({ code: 'LESSON_NOT_FOUND', message: 'Урок не найден.' });
    } else if (error.message === 'User not enrolled in this course.') {
        return res.status(403).json({ code: 'NOT_ENROLLED', message: 'Вы не записаны на курс этого урока.' });
    }
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Ошибка при завершении урока.' });
  }
};

module.exports = {
  enrollCourse,
  getProgress,
  rateCourse,
  completeLesson, // Add new controller
};