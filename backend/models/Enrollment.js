// ===== ./models/Enrollment.js =====
const db = require('../config/db');
const Course = require('./Course'); // We might need Course formatting

/**
 * Получение записей пользователя на курсы по статусу
 * @param {string} userId - ID пользователя
 * @param {string} status - Статус ('inProgress', 'completed')
 * @returns {Promise<Array>} - Массив записей с данными курсов
 */
const findByUserAndStatus = async (userId, status) => {
  const query = `
    SELECT 
      e.course_id,
      e.status,
      e.progress,
      e.started_at,
      e.finished_at,
      c.id, 
      c.author_id, 
      u.full_name AS author_name,
      c.title, 
      c.description, 
      c.difficulty, 
      c.language, 
      c.cover_url, 
      c.estimated_duration, 
      c.version, 
      c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments, 
      COALESCE(cs.avg_completion, 0) AS avg_completion, 
      COALESCE(cs.avg_score, 0) AS avg_score,
      -- Получаем оценку пользователя, если курс завершен
      CASE 
        WHEN e.status = 'completed' THEN (
          SELECT r.value 
          FROM ratings r 
          WHERE r.course_id = c.id AND r.user_id = e.user_id
          LIMIT 1
        ) 
        ELSE NULL 
      END AS user_rating
    FROM 
      enrollments e
    JOIN 
      courses c ON e.course_id = c.id
    JOIN 
      users u ON c.author_id = u.id
    LEFT JOIN 
      course_stats cs ON c.id = cs.course_id
    WHERE 
      e.user_id = $1 AND e.status = $2
    ORDER BY 
      e.started_at DESC;
  `;

  const result = await db.query(query, [userId, status]);

  // Получаем теги и уроки для каждого курса (может быть избыточно, зависит от дизайна карточки)
  const enrollmentsWithDetails = await Promise.all(result.rows.map(async row => {
    const tags = await Course.getCourseTags(row.course_id); // Используем функцию из Course модели
    const lessons = await Course.getCourseLessons(row.course_id); // Используем функцию из Course модели

    const formattedCourse = Course.formatCourseData(row, tags, lessons); // Форматируем данные курса

    return {
      // Данные записи (enrollment)
      status: row.status,
      progress: row.progress,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      userRating: row.user_rating, // Оценка пользователя для завершенных
      // Данные курса (вложенный объект)
      course: formattedCourse
    };
  }));

  return enrollmentsWithDetails;
};


/**
 * Запись пользователя на курс
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object>} - Созданная запись
 */
const enrollCourse = async (userId, courseId) => {
  // Проверяем, опубликован ли курс
  const courseResult = await db.query(
    'SELECT is_published FROM courses WHERE id = $1',
    [courseId]
  );
  if (courseResult.rows.length === 0 || !courseResult.rows[0].is_published) {
    throw new Error('Course not found or not published');
  }

  // Проверяем, не записан ли уже пользователь
  const existingEnrollment = await db.query(
    'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  if (existingEnrollment.rows.length > 0) {
    throw new Error('Already enrolled');
  }

  // Создаем запись
  const result = await db.query(
    `INSERT INTO enrollments 
       (user_id, course_id, status, progress, started_at) 
     VALUES 
       ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
     RETURNING *`,
    [userId, courseId, 'inProgress', 0]
  );

  // Обновляем статистику курса
  await db.query(
    `UPDATE course_stats 
     SET enrollments = enrollments + 1 
     WHERE course_id = $1`,
    [courseId]
  );

  // Обновляем статистику пользователя
  await db.query(
    `UPDATE user_stats 
     SET active_courses = active_courses + 1 
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0]; // Возвращаем базовые данные записи
};

/**
 * Получение прогресса пользователя по курсу
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object|null>} - Данные прогресса или null
 */
const getProgress = async (userId, courseId) => {
  const result = await db.query(
    'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Оценка курса пользователем
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @param {number} value - Оценка (1-5)
 * @returns {Promise<Object>} - Созданная оценка
 */
const rateCourse = async (userId, courseId, value) => {
  // Проверяем, записан ли пользователь на курс
  const enrollment = await getProgress(userId, courseId);
  if (!enrollment) {
    throw new Error('Not enrolled in the course');
  }
  // Опционально: разрешить оценку только завершенных курсов
  // if (enrollment.status !== 'completed') {
  //   throw new Error('Course must be completed to rate');
  // }

  // Проверяем, не оценил ли уже пользователь
  const existingRating = await db.query(
    'SELECT 1 FROM ratings WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  if (existingRating.rows.length > 0) {
    throw new Error('Already rated');
  }

  // Создаем оценку
  const result = await db.query(
    `INSERT INTO ratings 
       (user_id, course_id, value, created_at) 
     VALUES 
       ($1, $2, $3, CURRENT_TIMESTAMP) 
     RETURNING *`,
    [userId, courseId, value]
  );

  // Обновляем среднюю оценку курса
  await db.query(
    `UPDATE course_stats 
     SET avg_score = 
       (SELECT AVG(value)::numeric(5,2) FROM ratings WHERE course_id = $1) 
     WHERE course_id = $1`,
    [courseId]
  );

  return result.rows[0];
};


module.exports = {
  findByUserAndStatus,
  enrollCourse,
  getProgress,
  rateCourse
};