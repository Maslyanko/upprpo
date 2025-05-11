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