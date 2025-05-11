const express = require('express');
const router = express.Router();
const { getMe, updateMe, uploadAvatar } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

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

module.exports = router;