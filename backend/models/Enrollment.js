// ==== File: backend/models/Enrollment.js ====
const db = require('../config/db');
const CourseModel = require('./Course'); // To use formatting and helper functions

/**
 * Получение записей пользователя на курсы по статусу
 * @param {string} userId - ID пользователя
 * @param {string} status - Статус ('inProgress', 'completed')
 * @returns {Promise<Array>} - Массив записей с данными курсов
 */
const findByUserAndStatus = async (userId, status) => {
  const query = `
    SELECT
      e.user_id, e.course_id, e.status, e.progress, e.started_at, e.finished_at,
      c.id as course_id_from_c, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      r.value as user_rating_value
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    LEFT JOIN ratings r ON r.course_id = c.id AND r.user_id = e.user_id
    WHERE e.user_id = $1 AND e.status = $2
    ORDER BY e.started_at DESC;
  `;

  const result = await db.query(query, [userId, status]);

  return Promise.all(result.rows.map(async (row) => {
    // Reconstruct a course-like object for formatCourseData
    const courseDataForFormatting = {
      id: row.course_id_from_c, // Use alias to avoid conflict
      author_id: row.author_id,
      author_name: row.author_name,
      title: row.title,
      description: row.description,
      cover_url: row.cover_url,
      estimated_duration: row.estimated_duration,
      version: row.version,
      is_published: row.is_published,
      enrollments: row.enrollments,
      avg_completion: row.avg_completion,
      avg_rating: row.avg_rating, // Use new name
      created_at: null, // Not directly available, not crucial for this view
      updated_at: null, // Not directly available
    };

    const tags = await CourseModel.getCourseTagNames(row.course_id_from_c);
    // Lesson summaries might be too much for this list view, can be simplified or fetched on demand
    const lessonSummaries = await CourseModel.getCourseLessonSummaries(row.course_id_from_c);
    const formattedCourse = CourseModel.formatCourseData(courseDataForFormatting, tags, lessonSummaries);

    return {
      status: row.status,
      progress: row.progress,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      userRating: row.user_rating_value, // Rating from the ratings table
      course: formattedCourse,
    };
  }));
};


/**
 * Запись пользователя на курс
 * @param {string} userId - ID пользователя
 * @param {string} courseId - ID курса
 * @returns {Promise<Object>} - Созданная запись
 */
const enrollCourse = async (userId, courseId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const courseResult = await client.query(
      'SELECT is_published FROM courses WHERE id = $1',
      [courseId]
    );
    if (courseResult.rows.length === 0 || !courseResult.rows[0].is_published) {
      throw new Error('Course not found or not published');
    }

    const existingEnrollment = await client.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existingEnrollment.rows.length > 0) {
      throw new Error('Already enrolled');
    }

    const result = await client.query(
      `INSERT INTO enrollments (user_id, course_id, status, progress, started_at)
       VALUES ($1, $2, 'inProgress', 0, CURRENT_TIMESTAMP) RETURNING *`,
      [userId, courseId]
    );

    await client.query(
      `UPDATE course_stats SET enrollments = enrollments + 1 WHERE course_id = $1`,
      [courseId]
    );
    
    // User stats are now dynamic, so no update to user_stats table here.
    // The User model's findById/findByEmail will calculate active_courses.

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error enrolling in course:", error);
    throw error;
  } finally {
    client.release();
  }
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
 * @param {string} comment - Optional comment
 * @returns {Promise<Object>} - Созданная оценка
 */
const rateCourse = async (userId, courseId, value, comment = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const enrollment = await getProgress(userId, courseId); // Uses default pool, fine for read
    if (!enrollment) {
      throw new Error('Not enrolled in the course');
    }
    // Optionally allow rating only completed courses
    // if (enrollment.status !== 'completed') {
    //   throw new Error('Course must be completed to rate');
    // }

    // Upsert rating (Insert or Update if exists)
    const result = await client.query(
      `INSERT INTO ratings (user_id, course_id, value, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET value = EXCLUDED.value, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, courseId, value, comment]
    );

    // Update average rating in course_stats
    await client.query(
      `UPDATE course_stats
       SET avg_rating = (SELECT AVG(value)::numeric(3,2) FROM ratings WHERE course_id = $1)
       WHERE course_id = $1`,
      [courseId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error rating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findByUserAndStatus,
  enrollCourse,
  getProgress,
  rateCourse,
};