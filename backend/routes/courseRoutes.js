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
  rateCourse,
  completeLesson
} = require('../controllers/enrollmentController');
const { submitUserAnswer } = require('../controllers/answerController'); // NEW
const { protect } = require('../middleware/auth');

// ... existing course routes ...

/**
 * @route GET /courses
 * @desc Get all courses with filtering
 */
router.get('/', getCourses); 

/**
 * @route GET /courses/tags
 * @desc Get all unique course tags
 */
router.get('/tags', getAllTags);

/**
 * @route POST /courses
 * @desc Create a new course
 */
router.post('/', protect, createCourse);

/**
 * @route GET /courses/:courseId
 * @desc Get single course by ID.
 */
router.get('/:courseId', protect, getCourseById); 

/**
 * @route PUT /courses/:courseId
 * @desc Update a course
 */
router.put('/:courseId', protect, updateCourse);

/**
 * @route POST /courses/:courseId/publish
 * @desc Publish a course
 */
router.post('/:courseId/publish', protect, publishCourse);

/**
 * @route POST /courses/:courseId/enroll
 * @desc Enroll in a course
 */
router.post('/:courseId/enroll', protect, enrollCourse);

/**
 * @route GET /courses/:courseId/progress
 * @desc Get enrollment progress (overall for the course)
 */
router.get('/:courseId/progress', protect, getProgress);

/**
 * @route POST /courses/:courseId/rating
 * @desc Rate a course
 */
router.post('/:courseId/rating', protect, rateCourse);

/**
 * @route DELETE /courses/:courseId
 * @desc Delete a course
 */
router.delete('/:courseId', protect, deleteCourse);

/**
 * @route POST /lessons/:lessonId/complete
 * @desc Mark a lesson as complete for the logged-in user
 */
router.post('/lessons/:lessonId/complete', protect, completeLesson);


// --- New route for submitting answers ---
/**
 * @route POST /answers/questions/:questionId/submit
 * @desc Submit an answer for a specific question
 * @access Private (Protected by `protect` middleware)
 */
router.post('/answers/questions/:questionId/submit', protect, submitUserAnswer);


module.exports = router;