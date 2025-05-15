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