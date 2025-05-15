// ==== File: backend/models/User.js ====
const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Calculate user statistics dynamically.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} User statistics object.
 */
const calculateUserStats = async (userId) => {
  // Active courses: count of enrollments with status 'inProgress'
  const activeCoursesResult = await db.query(
    "SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1 AND status = 'inProgress'",
    [userId]
  );
  const activeCourses = parseInt(activeCoursesResult.rows[0].count, 10) || 0;

  // Completed courses: count of enrollments with status 'completed'
  const completedCoursesResult = await db.query(
    "SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1 AND status = 'completed'",
    [userId]
  );
  const completedCourses = parseInt(completedCoursesResult.rows[0].count, 10) || 0;

  // Average score: This is complex.
  // For now, let's use average of ratings GIVEN BY the user for completed courses.
  // Or average progress if no ratings. This is a placeholder and might need refinement.
  // A more robust avg_score would involve scores from lesson_progress or question attempts.
  // For simplicity, we will set it to 0 for now as the original user_stats.avg_score was also likely a placeholder.
  const avgScore = 0; // Placeholder

  return {
    activeCourses,
    completedCourses,
    avgScore, // Placeholder for now
  };
};

/**
 * Formats user data for API response, including calculated stats.
 * @param {Object} userData - Raw user data from the database.
 * @param {Object} stats - Calculated user statistics.
 * @returns {Object} Formatted user data.
 */
const formatUserDataWithStats = (userData, stats) => {
  const { password, ...userWithoutPassword } = userData; // Exclude password
  return {
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    fullName: userWithoutPassword.full_name,
    avatarUrl: userWithoutPassword.avatar_url,
    createdAt: userWithoutPassword.created_at,
    updatedAt: userWithoutPassword.updated_at,
    stats: stats || { activeCourses: 0, completedCourses: 0, avgScore: 0 },
  };
};


/**
 * Поиск пользователя по email
 * @param {string} email - Email пользователя
 * @param {boolean} includePassword - Whether to include the password hash (for login).
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findByEmail = async (email, includePassword = false) => {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  if (includePassword) {
    return user; // Return raw user data including password for login comparison
  }

  const stats = await calculateUserStats(user.id);
  return formatUserDataWithStats(user, stats);
};

/**
 * Поиск пользователя по ID
 * @param {string} id - ID пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findById = async (id) => {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }
  const user = result.rows[0];
  const stats = await calculateUserStats(user.id);
  return formatUserDataWithStats(user, stats);
};

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise<Object>} - Созданный пользователь
 */
const create = async (userData) => {
  const { email, password, fullName = null } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  // No transaction needed here as user_stats table is removed
  const userResult = await db.query(
    'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING id',
    [email, hashedPassword, fullName]
  );
  const userId = userResult.rows[0].id;
  return findById(userId); // Fetch with calculated stats
};

/**
 * Обновление данных пользователя
 * @param {string} id - ID пользователя
 * @param {Object} updateData - Данные для обновления
 * @returns {Promise<Object>} - Обновленный пользователь
 */
const update = async (id, updateData) => {
  const { fullName, avatarUrl } = updateData;
  const updateFields = [];
  const values = [];
  let counter = 1;

  if (fullName !== undefined) {
    updateFields.push(`full_name = $${counter}`);
    values.push(fullName);
    counter++;
  }

  if (avatarUrl !== undefined) {
    updateFields.push(`avatar_url = $${counter}`);
    values.push(avatarUrl);
    counter++;
  }

  if (updateFields.length === 0) {
    return findById(id); // No changes, just return current data
  }

  values.push(id); // For WHERE id = $counter

  await db.query(
    `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${counter} RETURNING id`,
    values
  );

  return findById(id); // Fetch updated user with stats
};

/**
 * Проверка пароля
 * @param {string} password - Введенный пароль
 * @param {string} hashedPassword - Хэшированный пароль из базы
 * @returns {Promise<boolean>} - Результат проверки
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// updateAvatar is effectively handled by the general update method if avatarUrl is passed.
// If a direct method is preferred, it can be kept, but it's redundant.
// For now, I'll remove the specific updateAvatar as `update` covers it.

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  comparePassword,
  // formatUserDataWithStats // Not typically exposed, used internally
};