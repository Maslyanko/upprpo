const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Поиск пользователя по email
 * @param {string} email - Email пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findByEmail = async (email) => {
  const result = await db.query(
    'SELECT u.*, us.active_courses, us.completed_courses, us.avg_score FROM users u ' +
    'LEFT JOIN user_stats us ON u.id = us.user_id ' +
    'WHERE u.email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  // ВАЖНО: Возвращаем полный объект включая password для внутреннего использования
  // Не форматируем данные здесь, чтобы сохранить password
  return result.rows[0];
};

/**
 * Поиск пользователя по ID
 * @param {string} id - ID пользователя
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
const findById = async (id) => {
  const result = await db.query(
    'SELECT u.*, us.active_courses, us.completed_courses, us.avg_score FROM users u ' +
    'LEFT JOIN user_stats us ON u.id = us.user_id ' +
    'WHERE u.id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  // Здесь форматируем данные, т.к. этот метод используется для API ответов
  return formatUserData(result.rows[0]);
};

/**
 * Создание нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise<Object>} - Созданный пользователь
 */
const create = async (userData) => {
  const { email, password, fullName = null } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Транзакция для создания пользователя и его статистики
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Создаем пользователя
    const userResult = await client.query(
      'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, fullName]
    );
    
    const user = userResult.rows[0];
    
    // Создаем запись статистики
    await client.query(
      'INSERT INTO user_stats (user_id, active_courses, completed_courses, avg_score) VALUES ($1, $2, $3, $4)',
      [user.id, 0, 0, 0]
    );
    
    await client.query('COMMIT');
    
    // Получаем полную информацию о пользователе
    const fullUser = await findById(user.id);
    return fullUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
    return await findById(id);
  }
  
  values.push(id);
  
  const result = await db.query(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${counter} RETURNING *`,
    values
  );
  
  return await findById(id);
};

/**
 * Форматирование данных пользователя для API
 * @param {Object} userData - Данные пользователя из базы
 * @returns {Object} - Форматированные данные пользователя
 */
const formatUserData = (userData) => {
  const { password, ...userWithoutPassword } = userData;
  
  return {
    id: userData.id,
    email: userData.email,
    fullName: userData.full_name,
    avatarUrl: userData.avatar_url,
    stats: {
      activeCourses: userData.active_courses || 0,
      completedCourses: userData.completed_courses || 0,
      avgScore: userData.avg_score || 0
    }
  };
};

/**
 * Проверка пароля
 * @param {string} password - Введенный пароль
 * @param {string} hashedPassword - Хэшированный пароль из базы
 * @returns {Promise<boolean>} - Результат проверки
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Обновление аватара пользователя
 * @param {string} id - ID пользователя
 * @param {string} avatarUrl - URL аватара
 * @returns {Promise<Object>} - Обновленный пользователь
 */
const updateAvatar = async (id, avatarUrl) => {
  await db.query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2',
    [avatarUrl, id]
  );
  
  return await findById(id);
};

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  comparePassword,
  updateAvatar,
  formatUserData // Экспортируем для использования в контроллере
};