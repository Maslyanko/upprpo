// ==== File: backend/models/Enrollment.js ====
const db = require('../config/db');
const CourseModel = require('./Course'); // To use formatting and helper functions

// _updateUserCourseProgress and _updateOverallCourseStats remain the same

async function _updateUserCourseProgress(userId, courseId, client) {
  const totalLessonsRes = await client.query(
    'SELECT COUNT(*) as count FROM lessons WHERE course_id = $1',
    [courseId]
  );
  const totalLessonsInCourse = parseInt(totalLessonsRes.rows[0].count, 10);

  if (totalLessonsInCourse === 0) {
    await client.query(
      "UPDATE enrollments SET progress = 0, status = 'inProgress', finished_at = NULL WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );
    return 0;
  }

  const completedLessonsRes = await client.query(
    'SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = $1 AND lesson_id IN (SELECT id FROM lessons WHERE course_id = $2) AND completed = true',
    [userId, courseId]
  );
  const completedLessonsByUser = parseInt(completedLessonsRes.rows[0].count, 10);
  const newProgress = parseFloat(((completedLessonsByUser / totalLessonsInCourse) * 100).toFixed(2));

  let status = 'inProgress';
  let finishedAtUpdateSql = 'finished_at = NULL'; // Default to reset finished_at if not completed

  if (newProgress >= 100) {
    status = 'completed';
    // Only set finished_at if it's not already set
    const currentEnrollment = await client.query('SELECT finished_at FROM enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
    if (currentEnrollment.rows.length > 0 && currentEnrollment.rows[0].finished_at === null) {
        finishedAtUpdateSql = 'finished_at = CURRENT_TIMESTAMP';
    } else if (currentEnrollment.rows.length > 0 && currentEnrollment.rows[0].finished_at !== null) {
        // Keep existing finished_at if already set
        finishedAtUpdateSql = 'finished_at = enrollments.finished_at'; // No change
    }
  }

  await client.query(
    `UPDATE enrollments 
     SET progress = $1, status = $2, ${finishedAtUpdateSql}
     WHERE user_id = $3 AND course_id = $4`,
    [newProgress, status, userId, courseId]
  );
  return newProgress;
}

async function _updateOverallCourseStats(courseId, client) {
  await client.query(
    `UPDATE course_stats 
     SET avg_completion = (SELECT AVG(progress) FROM enrollments WHERE course_id = $1 AND status = 'completed') -- Consider only completed for average
     WHERE course_id = $1`,
    [courseId]
  );
}


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
    const courseDataForFormatting = {
      id: row.course_id_from_c, 
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
      avg_rating: row.avg_rating,
      created_at: null, 
      updated_at: null, 
    };

    const tags = await CourseModel.getCourseTagNames(row.course_id_from_c);
    const lessonSummaries = await CourseModel.getCourseLessonSummaries(row.course_id_from_c, db, userId);
    const formattedCourse = CourseModel.formatCourseData(courseDataForFormatting, tags, lessonSummaries);

    return {
      status: row.status,
      progress: row.progress,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      userRating: row.user_rating_value,
      course: formattedCourse,
    };
  }));
};

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

    // Check for existing enrollment
    const existingEnrollment = await client.query(
      'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (existingEnrollment.rows.length > 0) {
      // User is already enrolled, return existing enrollment data with a flag
      await client.query('ROLLBACK'); // No changes to commit
      return { ...existingEnrollment.rows[0], alreadyEnrolled: true };
    }

    // New enrollment
    const result = await client.query(
      `INSERT INTO enrollments (user_id, course_id, status, progress, started_at)
       VALUES ($1, $2, 'inProgress', 0, CURRENT_TIMESTAMP) RETURNING *`,
      [userId, courseId]
    );

    // Increment enrollments count in course_stats
    await client.query(
      `UPDATE course_stats SET enrollments = enrollments + 1 WHERE course_id = $1`,
      [courseId]
    );
    
    await client.query('COMMIT');
    return result.rows[0]; // This is a new enrollment, so no 'alreadyEnrolled' flag
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error enrolling in course:", error);
    // Check for unique constraint violation error code (23505 for PostgreSQL)
    if (error.code === '23505') { 
        // This case should ideally be caught by the explicit check above,
        // but as a fallback for concurrent requests.
        const currentEnrollment = await getProgress(userId, courseId); // Fetch existing one
        if (currentEnrollment) {
            return { ...currentEnrollment, alreadyEnrolled: true, message: "Concurrency: Already enrolled."};
        }
        throw new Error('Already enrolled (concurrent issue).');
    }
    throw error; // Re-throw other errors
  } finally {
    if (!client.isReleased) client.release();
  }
};

const getProgress = async (userId, courseId) => {
  const result = await db.query(
    'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

const rateCourse = async (userId, courseId, value, comment = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const enrollmentCheck = await client.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (enrollmentCheck.rows.length === 0) {
      throw new Error('Not enrolled in the course');
    }
    
    const result = await client.query(
      `INSERT INTO ratings (user_id, course_id, value, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, course_id)
       DO UPDATE SET value = EXCLUDED.value, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, courseId, value, comment]
    );

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

const markLessonComplete = async (userId, lessonId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const lessonInfoRes = await client.query('SELECT course_id FROM lessons WHERE id = $1', [lessonId]);
    if (lessonInfoRes.rows.length === 0) {
      throw new Error('Lesson not found.');
    }
    const courseId = lessonInfoRes.rows[0].course_id;

    const enrollmentCheck = await client.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (enrollmentCheck.rows.length === 0) {
      throw new Error('User not enrolled in this course.');
    }

    // Ensure lesson_progress record exists or is created, then set to completed
    await client.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, score, last_activity)
       VALUES ($1, $2, true, COALESCE((SELECT score FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2), 0), CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET 
         completed = true, 
         last_activity = CURRENT_TIMESTAMP
      `,
      [userId, lessonId]
    );


    await _updateUserCourseProgress(userId, courseId, client);
    await _updateOverallCourseStats(courseId, client);

    await client.query('COMMIT');
    
    const updatedEnrollment = await getProgress(userId, courseId); 
    return {
      message: 'Lesson marked complete.',
      courseId: courseId,
      lessonId: lessonId,
      userProgress: updatedEnrollment.progress,
      userStatus: updatedEnrollment.status
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error marking lesson complete:", error);
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
  markLessonComplete,
};