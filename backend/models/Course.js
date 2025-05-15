// ==== File: backend/models/Course.js ====
const db = require('../config/db');
const Tag = require('./Tag'); // For tag handling

/**
 * Helper to get course tags by course ID.
 * @param {string} courseId
 * @param {Object} client - Optional DB client for transactions
 * @returns {Promise<Array<string>>} Array of tag names
 */
const getCourseTagNames = async (courseId, client = db) => {
  const result = await client.query(
    'SELECT t.name FROM tags t JOIN course_tags ct ON t.id = ct.tag_id WHERE ct.course_id = $1 ORDER BY t.name',
    [courseId]
  );
  return result.rows.map(row => row.name);
};

/**
 * Helper to get lesson summaries for a course.
 * (This will be more complex with pages, for now a simplified version)
 * @param {string} courseId
 * @param {Object} client - Optional DB client for transactions
 * @returns {Promise<Array<Object>>}
 */
const getCourseLessonSummaries = async (courseId, client = db) => {
  // This needs to fetch lessons, then for each lesson, determine if it has quiz pages.
  const lessonsResult = await client.query(
    `SELECT l.id, l.title, l.sort_order, l.description
     FROM lessons l
     WHERE l.course_id = $1
     ORDER BY l.sort_order`,
    [courseId]
  );

  const lessons = [];
  for (const lessonRow of lessonsResult.rows) {
    // A lesson "hasQuiz" if any of its pages are of type 'ASSIGNMENT' and have questions
    const quizPageCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM lesson_pages lp
         JOIN questions q ON lp.id = q.page_id
         WHERE lp.lesson_id = $1 AND lp.page_type = 'ASSIGNMENT'
       ) as has_quiz`,
      [lessonRow.id]
    );
    lessons.push({
      id: lessonRow.id,
      title: lessonRow.title,
      description: lessonRow.description,
      sortOrder: lessonRow.sort_order,
      // 'type' is removed from lesson, this needs rethinking. For now, 'hasQuiz' might suffice.
      // A lesson's "type" could be inferred (e.g., if it only has methodical pages vs. assignment pages)
      hasQuiz: quizPageCheck.rows[0].has_quiz,
    });
  }
  return lessons;
};

/**
 * Format course data for API response.
 * @param {Object} courseRow - Raw course data from DB.
 * @param {Array<string>} tags - Array of tag names.
 * @param {Array<Object>} lessons - Array of lesson summaries.
 * @returns {Object} Formatted course data.
 */
const formatCourseData = (courseRow, tags, lessons) => {
  // Extract difficulty and language from tags if they exist
  const difficultyTag = tags.find(tag => ['Beginner', 'Middle', 'Senior'].includes(tag)) || null;
  // You might have a predefined list of language tags to check against
  // For simplicity, I'm not extracting language separately here, it's just another tag.
  // If you need 'language' as a separate field in the response, you'd add logic here.

  return {
    id: courseRow.id,
    authorId: courseRow.author_id,
    authorName: courseRow.author_name, // From JOIN
    title: courseRow.title,
    description: courseRow.description,
    coverUrl: courseRow.cover_url,
    estimatedDuration: courseRow.estimated_duration,
    version: courseRow.version,
    isPublished: courseRow.is_published,
    tags: tags || [],
    difficulty: difficultyTag, // This is now one of the tags
    // language: languageTag, // Example if you extract it
    stats: {
      enrollments: parseInt(courseRow.enrollments, 10) || 0,
      avgCompletion: parseFloat(courseRow.avg_completion) || 0,
      avgRating: parseFloat(courseRow.avg_rating) || 0, // Was avg_score
    },
    lessons: lessons || [], // Lesson summaries
    createdAt: courseRow.created_at,
    updatedAt: courseRow.updated_at,
  };
};

const findAll = async (filters = {}) => {
  const { search, tags: filterTags = [], difficulty, language } = filters; // `sort` can be added later

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

  // Combine difficulty, language, and other tags for filtering
  const allFilterTagNames = [...filterTags];
  if (difficulty) allFilterTagNames.push(difficulty);
  if (language) allFilterTagNames.push(language);

  if (allFilterTagNames.length > 0) {
    // This subquery ensures the course has ALL specified tags.
    // If you want ANY, you'd use `t.name = ANY($${paramIndex})` and adjust the count.
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
  query += ` ORDER BY c.created_at DESC`; // Default sort

  const result = await db.query(query, queryParams);

  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id);
    const lessonSummaries = await getCourseLessonSummaries(row.id);
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

const findById = async (id, version = null) => {
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
  }
  queryText += ` ORDER BY c.version DESC LIMIT 1`;


  const result = await db.query(queryText, queryParams);
  if (result.rows.length === 0) return null;

  const courseRow = result.rows[0];
  const courseTags = await getCourseTagNames(courseRow.id);

  // Fetch detailed lessons and pages for a single course view
  const lessonsResult = await db.query(
    `SELECT id, title, description, sort_order FROM lessons WHERE course_id = $1 ORDER BY sort_order`,
    [courseRow.id]
  );

  const detailedLessons = [];
  for (const lesson of lessonsResult.rows) {
    const pagesResult = await db.query(
      `SELECT id, title, page_type, sort_order FROM lesson_pages WHERE lesson_id = $1 ORDER BY sort_order`,
      [lesson.id]
    );
    const pages = [];
    for (const page of pagesResult.rows) {
      let pageDetails = { ...page, content: null, questions: [] };
      if (page.page_type === 'METHODICAL') {
        const contentResult = await db.query('SELECT content FROM methodical_page_content WHERE page_id = $1', [page.id]);
        if (contentResult.rows.length > 0) {
          pageDetails.content = contentResult.rows[0].content;
        }
      } else if (page.page_type === 'ASSIGNMENT') {
        const questionsResult = await db.query(
          'SELECT id, text, type, sort_order FROM questions WHERE page_id = $1 ORDER BY sort_order',
          [page.id]
        );
        for (const question of questionsResult.rows) {
          const optionsResult = await db.query(
            'SELECT id, label, is_correct, sort_order FROM question_options WHERE question_id = $1 ORDER BY sort_order',
            [question.id]
          );
          pageDetails.questions.push({ ...question, options: optionsResult.rows });
        }
      }
      pages.push(pageDetails);
    }
    detailedLessons.push({ ...lesson, pages });
  }

  return formatCourseData(courseRow, courseTags, detailedLessons); // Pass detailedLessons here
};

const create = async (courseData, authorId) => {
  const {
    title, description, tags = [], // Expect array of tag names, e.g., ["Python", "Beginner"]
    coverUrl = '/images/courses/default.png',
    estimatedDuration = 0, // Can be calculated later
    lessonsData = [], // Expects an array of lesson objects, each with pages, etc.
  } = courseData;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create Course
    const courseResult = await client.query(
      `INSERT INTO courses (author_id, title, description, cover_url, estimated_duration, version, is_published)
       VALUES ($1, $2, $3, $4, $5, 1, false) RETURNING *`,
      [authorId, title, description, coverUrl, estimatedDuration]
    );
    const course = courseResult.rows[0];
    const courseId = course.id;

    // 2. Create Course Stats
    await client.query('INSERT INTO course_stats (course_id) VALUES ($1)', [courseId]);

    // 3. Handle Tags
    if (tags.length > 0) {
      for (const tagName of tags) {
        const tag = await Tag.findOrCreate(tagName, client);
        await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2)', [courseId, tag.id]);
      }
    }

    // 4. Handle Lessons and their Pages
    let lessonSortOrder = 0;
    for (const lessonInput of lessonsData) {
      const lessonResult = await client.query(
        `INSERT INTO lessons (course_id, title, description, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [courseId, lessonInput.title, lessonInput.description || null, lessonSortOrder++]
      );
      const lessonId = lessonResult.rows[0].id;

      let pageSortOrder = 0;
      for (const pageInput of lessonInput.pages || []) {
        const pageResult = await client.query(
          `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [lessonId, pageInput.title, pageInput.pageType, pageSortOrder++]
        );
        const pageId = pageResult.rows[0].id;

        if (pageInput.pageType === 'METHODICAL' && pageInput.content) {
          await client.query(
            'INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
            [pageId, pageInput.content]
          );
        } else if (pageInput.pageType === 'ASSIGNMENT' && pageInput.questions) {
          let questionSortOrder = 0;
          for (const qInput of pageInput.questions) {
            const questionResult = await client.query(
              `INSERT INTO questions (page_id, text, type, sort_order)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [pageId, qInput.text, qInput.type, questionSortOrder++]
            );
            const questionId = questionResult.rows[0].id;

            if (qInput.options) {
              let optionSortOrder = 0;
              for (const optInput of qInput.options) {
                await client.query(
                  `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                   VALUES ($1, $2, $3, $4)`,
                  [questionId, optInput.label, optInput.isCorrect || false, optionSortOrder++]
                );
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    return findById(courseId); // Return full course details
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const update = async (courseId, updateData, authorId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check ownership and if published
    const courseCheck = await client.query(
      'SELECT is_published FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) throw new Error('Course not found or not authorized');
    if (courseCheck.rows[0].is_published) throw new Error('Cannot update published course. Create a new version.');

    // 2. Update basic course fields
    const { title, description, coverUrl, estimatedDuration, tags, lessonsData } = updateData;
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
    }

    // 3. Update Tags (delete old, insert new)
    if (tags !== undefined) {
      await client.query('DELETE FROM course_tags WHERE course_id = $1', [courseId]);
      if (tags.length > 0) {
        for (const tagName of tags) {
          const tag = await Tag.findOrCreate(tagName, client);
          await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tag.id]);
        }
      }
    }

    // 4. Update Lessons and Pages (more complex: diffing or delete-recreate)
    // For simplicity in this example, we'll do delete-recreate for lessons and their children.
    // A more sophisticated approach would involve diffing and updating existing entities.
    if (lessonsData !== undefined) {
      // Delete existing lessons and their dependent content (cascade should handle pages, content, questions)
      await client.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);

      let lessonSortOrder = 0;
      for (const lessonInput of lessonsData) {
        const lessonResult = await client.query(
          `INSERT INTO lessons (course_id, title, description, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [courseId, lessonInput.title, lessonInput.description || null, lessonSortOrder++]
        );
        const lessonId = lessonResult.rows[0].id;

        let pageSortOrder = 0;
        for (const pageInput of lessonInput.pages || []) {
          const pageResult = await client.query(
            `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [lessonId, pageInput.title, pageInput.pageType, pageSortOrder++]
          );
          const pageId = pageResult.rows[0].id;

          if (pageInput.pageType === 'METHODICAL' && pageInput.content) {
            await client.query(
              'INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
              [pageId, pageInput.content]
            );
          } else if (pageInput.pageType === 'ASSIGNMENT' && pageInput.questions) {
            let questionSortOrder = 0;
            for (const qInput of pageInput.questions) {
              const questionResult = await client.query(
                `INSERT INTO questions (page_id, text, type, sort_order)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [pageId, qInput.text, qInput.type, questionSortOrder++]
              );
              const questionId = questionResult.rows[0].id;

              if (qInput.options) {
                let optionSortOrder = 0;
                for (const optInput of qInput.options) {
                  await client.query(
                    `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                     VALUES ($1, $2, $3, $4)`,
                    [questionId, optInput.label, optInput.isCorrect || false, optionSortOrder++]
                  );
                }
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    return findById(courseId);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const publish = async (courseId, authorId) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const courseCheck = await client.query(
      'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
      [courseId, authorId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found or not authorized');
    }
    // Consider version increment logic here if not creating a new row
    // For this example, just setting is_published = true and incrementing version on the same row
    await client.query(
      'UPDATE courses SET is_published = true, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [courseId]
    );
    await client.query('COMMIT');
    return findById(courseId);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error publishing course:", error);
    throw error;
  } finally {
    client.release();
  }
};

const findByAuthor = async (authorId) => {
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
  const result = await db.query(query, [authorId]);
  return Promise.all(result.rows.map(async (row) => {
    const courseTags = await getCourseTagNames(row.id);
    const lessonSummaries = await getCourseLessonSummaries(row.id); // Simplified for list view
    return formatCourseData(row, courseTags, lessonSummaries);
  }));
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  publish,
  findByAuthor,
  getCourseTagNames, // Exported for potential use elsewhere (e.g. Enrollment model)
  getCourseLessonSummaries, // Exported for potential use elsewhere
  formatCourseData, // Exported for potential use elsewhere
};