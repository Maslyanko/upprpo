// ==== File: backend/routes/courseRoutes.js ====
const express = require('express');
const router = express.Router();
const { 
  getCourses, 
  getCourseById, 
  createCourse, 
  updateCourse, 
  publishCourse,
  getAllTags // <-- IMPORTED
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

module.exports = router;