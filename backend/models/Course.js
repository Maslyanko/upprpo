// ==== File: backend/models/Course.js ====
// ==== File: backend/models/Course.js ====
// ==== File: backend/models/Course.js ====
const db = require('../config/db');
const Tag = require('./Tag'); // For tag handling

/**
 * Helper to get course tags by course ID.
 * @param {string} courseId
 * @param {Object} dbClient - DB client for transactions or default db module
 * @returns {Promise<Array<string>>} Array of tag names
 */
const getCourseTagNames = async (courseId, dbClient = db) => {
  const result = await dbClient.query(
    'SELECT t.name FROM tags t JOIN course_tags ct ON t.id = ct.tag_id WHERE ct.course_id = $1 ORDER BY t.name',
    [courseId]
  );
  return result.rows.map(row => row.name);
};

/**
 * Helper to get lesson summaries for a course.
 * @param {string} courseId
 * @param {Object} dbClient - DB client for transactions or default db module
 * @param {string | null} userIdForProgress - Optional user ID to fetch their progress
 * @returns {Promise<Array<Object>>}
 */
const getCourseLessonSummaries = async (courseId, dbClient = db, userIdForProgress = null) => {
  const lessonsResult = await dbClient.query(
    `SELECT l.id, l.title, l.sort_order, l.description
     FROM lessons l
     WHERE l.course_id = $1
     ORDER BY l.sort_order`,
    [courseId]
  );

  const lessons = [];
  for (const lessonRow of lessonsResult.rows) {
    const quizPageCheck = await dbClient.query(
      `SELECT EXISTS (
         SELECT 1
         FROM lesson_pages lp
         JOIN questions q ON lp.id = q.page_id
         WHERE lp.lesson_id = $1 AND lp.page_type = 'ASSIGNMENT'
       ) as has_quiz`,
      [lessonRow.id]
    );

    let completedByUser = false;
    if (userIdForProgress) {
      const progressCheck = await dbClient.query(
        'SELECT completed FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
        [userIdForProgress, lessonRow.id]
      );
      if (progressCheck.rows.length > 0) {
        completedByUser = progressCheck.rows[0].completed;
      }
    }

    lessons.push({
      id: lessonRow.id,
      title: lessonRow.title,
      description: lessonRow.description,
      sort_order: lessonRow.sort_order,
      hasQuiz: quizPageCheck.rows[0].has_quiz,
      completedByUser: completedByUser,
    });
  }
  return lessons;
};

/**
 * Format course data for API response.
 * @param {Object} courseRow - Raw course data from DB.
 * @param {Array<string>} tags - Array of tag names.
 * @param {Array<Object>} lessons - Array of lesson summaries or detailed lessons.
 * @returns {Object} Formatted course data.
 */
const formatCourseData = (courseRow, tags, lessons) => {
  const difficultyTag = tags.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag)) || null;
  const KNOWN_LANGUAGES_FOR_FORMAT = ['Python', 'JavaScript', 'Java', 'SQL', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Rust', 'TypeScript', 'English', 'Русский'];
  const languageTag = tags.find(tag => KNOWN_LANGUAGES_FOR_FORMAT.includes(tag)) || null;

  return {
    id: courseRow.id,
    authorId: courseRow.author_id,
    authorName: courseRow.author_name,
    title: courseRow.title,
    description: courseRow.description,
    coverUrl: courseRow.cover_url,
    estimatedDuration: courseRow.estimated_duration,
    version: courseRow.version,
    isPublished: courseRow.is_published,
    tags: tags || [],
    difficulty: difficultyTag,
    language: languageTag,
    stats: {
      enrollments: parseInt(courseRow.enrollments, 10) || 0,
      avgCompletion: parseFloat(courseRow.avg_completion) || 0,
      avgRating: parseFloat(courseRow.avg_rating) || 0,
    },
    lessons: lessons || [],
    createdAt: courseRow.created_at,
    updatedAt: courseRow.updated_at,
  };
};

const findAll = async (filters = {}, userIdForProgress = null) => {
  const { search, tags: filterTags = [], difficulty, language } = filters;

  let query = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
  `;
  const whereConditions = ["c.is_published = true"];
  const queryParams = [];
  let paramIndex = 1;

  if (search) {
    whereConditions.push(`(c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const allFilterTagNames = [...filterTags];
  if (difficulty) allFilterTagNames.push(difficulty);
  if (language) allFilterTagNames.push(language);

  if (allFilterTagNames.length > 0) {
    const tagPlaceholders = allFilterTagNames.map((_, i) => `$${paramIndex + i}`).join(',');
    whereConditions.push(`
      c.id IN (
        SELECT ct.course_id
        FROM course_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name IN (${tagPlaceholders})
        GROUP BY ct.course_id
        HAVING COUNT(DISTINCT t.id) = ${allFilterTagNames.length}
      )
    `);
    queryParams.push(...allFilterTagNames);
    paramIndex += allFilterTagNames.length;
  }

  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  query += ` ORDER BY c.created_at DESC`;

  const result = await db.query(query, queryParams); // Using default db.query for the main fetch

  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id); // Uses default dbClient
    const lessonSummaries = await getCourseLessonSummaries(row.id, db, userIdForProgress); // Pass db and userIdForProgress
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

// Signature changed: dbClient is now the last optional parameter.
const findById = async (id, version = null, userIdForProgress = null, dbClient = db) => {
  let queryText = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    WHERE c.id = $1
  `;
  const queryParams = [id];
  if (version) {
    queryText += ` AND c.version = $2`;
    queryParams.push(version);
  } else {
    queryText += ` ORDER BY c.is_published DESC, c.version DESC LIMIT 1`;
  }

  const result = await dbClient.query(queryText, queryParams);
  if (result.rows.length === 0) return null;

  const courseRow = result.rows[0];
  const courseTags = await getCourseTagNames(courseRow.id, dbClient);

  const lessonsResult = await dbClient.query(
    `SELECT id, title, description, sort_order FROM lessons WHERE course_id = $1 ORDER BY sort_order`,
    [courseRow.id]
  );

  const detailedLessons = [];
  for (const lesson of lessonsResult.rows) {
    const pagesResult = await dbClient.query(
      `SELECT id, title, page_type, sort_order FROM lesson_pages WHERE lesson_id = $1 ORDER BY sort_order`,
      [lesson.id]
    );
    const pages = [];
    for (const page of pagesResult.rows) {
      let pageDetails = { ...page, content: null, questions: [] };
      if (page.page_type === 'METHODICAL') {
        const contentResult = await dbClient.query('SELECT content FROM methodical_page_content WHERE page_id = $1', [page.id]);
        if (contentResult.rows.length > 0) {
          pageDetails.content = contentResult.rows[0].content;
        }
      } else if (page.page_type === 'ASSIGNMENT') {
        const questionsResult = await dbClient.query(
          'SELECT id, text, type, correct_answer, sort_order FROM questions WHERE page_id = $1 ORDER BY sort_order',
          [page.id]
        );
        for (const question of questionsResult.rows) {
          const optionsResult = await dbClient.query(
            'SELECT id, label, is_correct, sort_order FROM question_options WHERE question_id = $1 ORDER BY sort_order',
            [question.id]
          );
          pageDetails.questions.push({ ...question, options: optionsResult.rows });
        }
      }
      pages.push(pageDetails);
    }

    let completedByUser = false;
    if (userIdForProgress) {
      const progressCheck = await dbClient.query(
        'SELECT completed FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
        [userIdForProgress, lesson.id]
      );
      if (progressCheck.rows.length > 0) {
        completedByUser = progressCheck.rows[0].completed;
      }
    }
    detailedLessons.push({ ...lesson, pages, completedByUser });
  }
  return formatCourseData(courseRow, courseTags, detailedLessons);
};

async function _updateOrInsertLessons(dbClient, courseId, lessonsData) {
  await dbClient.query(
    `DELETE FROM lesson_pages WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)`,
    [courseId]
  );
  await dbClient.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);

  if (lessonsData && Array.isArray(lessonsData)) {
    for (let lessonIdx = 0; lessonIdx < lessonsData.length; lessonIdx++) {
      const lessonInput = lessonsData[lessonIdx];
      const lessonResult = await dbClient.query(
        `INSERT INTO lessons (course_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [courseId, lessonInput.title, lessonInput.description || null, lessonIdx]
      );
      const lessonId = lessonResult.rows[0].id;

      if (Array.isArray(lessonInput.pages)) {
        for (let pageIdx = 0; pageIdx < lessonInput.pages.length; pageIdx++) {
          const pageInput = lessonInput.pages[pageIdx];
          const pageResult = await dbClient.query(
            `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [lessonId, pageInput.title, pageInput.page_type, pageIdx]
          );
          const pageId = pageResult.rows[0].id;

          if (pageInput.page_type === 'METHODICAL' && pageInput.content) {
            await dbClient.query(
              'INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
              [pageId, pageInput.content]
            );
          } else if (pageInput.page_type === 'ASSIGNMENT' && Array.isArray(pageInput.questions)) {
            for (let questionIdx = 0; questionIdx < pageInput.questions.length; questionIdx++) {
              const qInput = pageInput.questions[questionIdx];
              const questionResult = await dbClient.query(
                `INSERT INTO questions (page_id, text, type, correct_answer, sort_order)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [pageId, qInput.text, qInput.type, qInput.correct_answer || null, questionIdx]
              );
              const questionId = questionResult.rows[0].id;

              if (Array.isArray(qInput.options)) {
                for (let optionIdx = 0; optionIdx < qInput.options.length; optionIdx++) {
                  const optInput = qInput.options[optionIdx];
                  await dbClient.query(
                    `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                     VALUES ($1, $2, $3, $4)`,
                    [questionId, optInput.label, optInput.is_correct || false, optionIdx]
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}

const create = async (courseData, authorId) => {
  const {
    title, description, tags = [],
    coverUrl = '/images/courses/default.png',
    estimatedDuration = 0,
    lessonsData = [],
  } = courseData;

  const client = await db.pool.connect(); // Transaction client
  try {
    await client.query('BEGIN');

    const courseResult = await client.query(
      `INSERT INTO courses (author_id, title, description, cover_url, estimated_duration, version, is_published)
       VALUES ($1, $2, $3, $4, $5, 1, false) RETURNING *`,
      [authorId, title, description, coverUrl, estimatedDuration]
    );
    const course = courseResult.rows[0];
    const courseId = course.id;

    await client.query('INSERT INTO course_stats (course_id) VALUES ($1)', [courseId]);

    if (tags.length > 0) {
      for (const tagName of tags) {
        const tag = await Tag.findOrCreate(tagName, client);
        await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tag.id]);
      }
    }
    
    await _updateOrInsertLessons(client, courseId, lessonsData);

    await client.query('COMMIT');
    // Call findById with the transaction client and userIdForProgress=null
    return findById(courseId, null, null, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const publish = async (courseId, authorId) => {
  const client = await db.pool.connect(); // Transaction client
  try {
    await client.query('BEGIN');
    const courseCheck = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found or not authorized');
    }
    await client.query(
      'UPDATE courses SET is_published = true, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [courseId]
    );
    await client.query('COMMIT');
    // Call findById with the transaction client and userIdForProgress=null
    return findById(courseId, null, null, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error publishing course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const findByAuthor = async (authorId, userIdForProgressToPass = null) => {
  const query = `
    SELECT
      c.id, c.author_id, u.full_name AS author_name, c.title, c.description,
      c.cover_url, c.estimated_duration, c.version, c.is_published,
      COALESCE(cs.enrollments, 0) AS enrollments,
      COALESCE(cs.avg_completion, 0) AS avg_completion,
      COALESCE(cs.avg_rating, 0) AS avg_rating,
      c.created_at, c.updated_at
    FROM courses c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN course_stats cs ON c.id = cs.course_id
    WHERE c.author_id = $1
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(query, [authorId]); // Main query uses default db
  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id); // Uses default db
    const lessonSummaries = await getCourseLessonSummaries(row.id, db, userIdForProgressToPass); // Pass db and the user ID
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

const update = async (courseId, updateData, authorId) => {
  const client = await db.pool.connect(); // Transaction client
  try {
    await client.query('BEGIN');

    const courseCheckResult = await client.query(
      'SELECT is_published, author_id, version FROM courses WHERE id = $1',
      [courseId]
    );
    if (courseCheckResult.rows.length === 0) throw new Error('Course not found');
    
    const courseInfo = courseCheckResult.rows[0];
    if (courseInfo.author_id !== authorId) throw new Error('Not authorized to update this course');
    
    const { title, description, coverUrl, estimatedDuration, tags, lessons } = updateData;
    let newVersionRequired = false;

    if (title !== undefined || description !== undefined || coverUrl !== undefined || estimatedDuration !== undefined || tags !== undefined) {
      const courseUpdateFields = [];
      const courseUpdateValues = [];
      let courseParamIdx = 1;
      const addField = (field, value) => {
        if (value !== undefined) {
          courseUpdateFields.push(`${field} = $${courseParamIdx++}`);
          courseUpdateValues.push(value);
        }
      };
      addField('title', title);
      addField('description', description);
      addField('cover_url', coverUrl);
      addField('estimated_duration', estimatedDuration);

      if (courseUpdateFields.length > 0) {
        courseUpdateValues.push(courseId);
        await client.query(
          `UPDATE courses SET ${courseUpdateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${courseParamIdx}`,
          courseUpdateValues
        );
        if (courseInfo.is_published) newVersionRequired = true;
      }

      if (tags !== undefined) { 
        await client.query('DELETE FROM course_tags WHERE course_id = $1', [courseId]);
        if (Array.isArray(tags) && tags.length > 0) {
          for (const tagName of tags) {
            const tag = await Tag.findOrCreate(tagName, client);
            await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tag.id]);
          }
        }
        if (courseInfo.is_published) newVersionRequired = true;
      }
    }
    
    if (lessons !== undefined && Array.isArray(lessons)) {
      await _updateOrInsertLessons(client, courseId, lessons);
      if (courseInfo.is_published) {
        newVersionRequired = true;
      }
    }

    if (newVersionRequired && courseInfo.is_published) {
      await client.query(
        'UPDATE courses SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', 
        [courseId]
      );
    } else if (title !== undefined || description !== undefined || coverUrl !== undefined || estimatedDuration !== undefined || tags !== undefined || (lessons !== undefined && Array.isArray(lessons))) {
      await client.query('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [courseId]);
    }

    await client.query('COMMIT');
    // Call findById with transaction client, passing authorId as userIdForProgress
    return findById(courseId, null, authorId, client);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const deleteById = async (courseId, authorId) => {
  const client = await db.pool.connect(); // Transaction client
  try {
    await client.query('BEGIN');

    const courseCheck = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found or not authorized');
    }
    await client.query('DELETE FROM courses WHERE id = $1', [courseId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting course:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  publish,
  findByAuthor,
  getCourseTagNames,
  getCourseLessonSummaries,
  formatCourseData,
  deleteById
};