// ==== File: backend/models/Course.js ====
// ===== ./backend/models/Course.js =====
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid'); // Keep if used for lessons/questions internally

/**
 * Получение тегов курса (Helper Function)
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив тегов
 */
const getCourseTags = async (courseId) => {
    const result = await db.query(
        'SELECT tag FROM course_tags WHERE course_id = $1 ORDER BY tag', // Added ORDER BY for consistency
        [courseId]
    );
    return result.rows.map(row => row.tag);
};

/**
 * Получение уроков курса (Summary) (Helper Function)
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив уроков (summary)
 */
const getCourseLessons = async (courseId) => {
    const result = await db.query(
        `SELECT
          l.id,
          l.title,
          l.type,
          CASE WHEN EXISTS (
            SELECT 1 FROM questions q WHERE q.lesson_id = l.id
          ) THEN true ELSE false END AS has_quiz
         FROM
          lessons l
         WHERE
          l.course_id = $1
         ORDER BY
          l.sort_order`,
        [courseId]
    );
    // Map to ensure consistent keys (camelCase) expected by frontend
    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type, // Assuming 'Theory' / 'Coding' match enum
        hasQuiz: row.has_quiz
    }));
};

/**
 * Форматирование данных курса для API (Helper Function)
 * @param {Object} courseData - Данные курса из базы (row)
 * @param {Array} tags - Теги курса
 * @param {Array} lessons - Уроки курса (summary)
 * @returns {Object} - Форматированные данные курса
 */
const formatCourseData = (courseData, tags, lessons) => {
    // Ensure stats are numbers and handle nulls gracefully
    const stats = {
        enrollments: parseInt(courseData.enrollments, 10) || 0,
        avgCompletion: parseFloat(courseData.avg_completion) || 0,
        avgScore: parseFloat(courseData.avg_score) || 0.0 // Default to 0.0
    };

    return {
        id: courseData.id,
        authorId: courseData.author_id,
        authorName: courseData.author_name, // Comes from JOIN in queries
        title: courseData.title,
        description: courseData.description,
        difficulty: courseData.difficulty, // Ensure matches 'Beginner', 'Middle', 'Senior'
        language: courseData.language,
        coverUrl: courseData.cover_url,
        tags: tags || [], // Ensure tags is always an array
        estimatedDuration: courseData.estimated_duration, // Frontend handles null if needed
        version: courseData.version,
        isPublished: courseData.is_published,
        stats: stats,
        lessons: lessons || [] // Ensure lessons is always an array
    };
};


/**
 * Получение всех курсов с фильтрацией
 * @param {Object} filters - Параметры фильтрации
 * @returns {Promise<Array>} - Массив курсов
 */
const findAll = async (filters = {}) => {
    // The 'tags' in filters is expected to be an array of strings, e.g., ['Python', 'JavaScript']
    const { search, difficulty, sort, tags = [], language } = filters;

    let query = `
      SELECT
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
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
    `;

    const whereConditions = [];
    const values = [];
    let valueCounter = 1;

    whereConditions.push(`c.is_published = true`);

    if (search) {
        whereConditions.push(`(
          c.title ILIKE $${valueCounter}
          OR c.description ILIKE $${valueCounter}
          OR u.full_name ILIKE $${valueCounter}
          OR EXISTS (
            SELECT 1 FROM course_tags ct_search
            WHERE ct_search.course_id = c.id AND ct_search.tag ILIKE $${valueCounter}
          )
        )`);
        values.push(`%${search}%`);
        valueCounter++;
    }

    if (difficulty) {
        whereConditions.push(`c.difficulty = $${valueCounter}`);
        values.push(difficulty);
        valueCounter++;
    }

    if (language) {
        whereConditions.push(`c.language = $${valueCounter}`);
        values.push(language);
        valueCounter++;
    }

    // Tags Filter
    if (tags && tags.length > 0) {
        // Ensure 'tags' is a flat array of strings.
        // The controller should already provide this.
        const flatTags = tags.flat(); // Just in case, though controller should handle it.
        if (flatTags.length > 0) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM course_tags ct
                WHERE ct.course_id = c.id AND ct.tag = ANY($${valueCounter})
            )`);
            values.push(flatTags); // Ensure this is a flat array ['tag1', 'tag2']
            valueCounter++;
        }
    }

    if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Sorting (remains the same)
    let orderByClause = ` ORDER BY c.created_at DESC`;
    if (sort) { /* ... sorting logic ... */ }
    query += orderByClause;

    console.log("Executing Course FindAll Query:", query);
    console.log("Query Values for FindAll:", values); // Changed log label

    const result = await db.query(query, values);

    const coursesData = await Promise.all(result.rows.map(async courseRow => {
        const courseTagsList = await getCourseTags(courseRow.id);
        const courseLessonsList = await getCourseLessons(courseRow.id);
        return formatCourseData(courseRow, courseTagsList, courseLessonsList);
    }));

    return coursesData;
};

/**
 * Получение курса по ID
 * @param {string} id - ID курса
 * @param {number} version - Версия курса (опционально)
 * @returns {Promise<Object|null>} - Найденный курс или null
 */
const findById = async (id, version = null) => {
    let query = `
      SELECT
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
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
      WHERE c.id = $1
    `;

    const values = [id];

    if (version) {
        query += ` AND c.version = $2`;
        values.push(version);
    } else {
        // If no specific version requested, usually get the latest published or the draft
        // For simplicity, let's assume getting *any* version by ID is okay for now.
        // More complex logic might be needed (e.g., get highest version number).
    }

     // Limit to 1 in case multiple versions exist and no specific one was asked for
    query += ` ORDER BY c.version DESC LIMIT 1`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
        return null;
    }

    const courseRow = result.rows[0];
    const tags = await getCourseTags(id); // Use the found course's ID
    const lessons = await getCourseLessons(id); // Use the found course's ID

    return formatCourseData(courseRow, tags, lessons);
};

/**
 * Создание нового курса (черновик)
 * @param {Object} courseData - Данные курса (title, description, difficulty, etc.)
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Созданный курс
 */
const create = async (courseData, authorId) => {
    const {
        title,
        description,
        difficulty,
        language = null, // Default to null if not provided
        tags = [],
        lessons = [], // Expect full lesson structure for creation
        coverUrl = null, // Allow setting cover URL during creation
        estimatedDuration = null // Allow setting duration
    } = courseData;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create course record (version 1, unpublished)
        const courseResult = await client.query(
            `INSERT INTO courses
              (author_id, title, description, difficulty, language, cover_url, estimated_duration, version, is_published)
             VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [authorId, title, description, difficulty, language, coverUrl, estimatedDuration, 1, false] // Start as unpublished draft
        );
        const course = courseResult.rows[0];
        const courseId = course.id;

        // 2. Create initial course stats
        await client.query(
            `INSERT INTO course_stats (course_id, enrollments, avg_completion, avg_score) VALUES ($1, 0, 0, 0)`,
            [courseId]
        );

        // 3. Add tags
        if (tags.length > 0) {
            const tagValues = tags.map((tag, index) => `($1, $${index + 2})`).join(', ');
            const tagParams = [courseId, ...tags];
            await client.query(
                `INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`,
                tagParams
            );
        }

        // 4. Add lessons and their content/quizzes
        if (lessons.length > 0) {
            for (let i = 0; i < lessons.length; i++) {
                const lesson = lessons[i];
                const lessonResult = await client.query(
                    `INSERT INTO lessons (course_id, title, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
                    [courseId, lesson.title, lesson.type, i]
                );
                const lessonId = lessonResult.rows[0].id;

                // Add lesson content
                await client.query(
                    `INSERT INTO lesson_content (lesson_id, content, video_url) VALUES ($1, $2, $3)`,
                    [lessonId, lesson.content || '', lesson.videoUrl || null]
                );

                // Add quiz questions and options
                if (lesson.quiz && lesson.quiz.length > 0) {
                    for (let j = 0; j < lesson.quiz.length; j++) {
                        const question = lesson.quiz[j];
                        const questionResult = await client.query(
                            `INSERT INTO questions (lesson_id, text, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
                            [lessonId, question.text, question.type, j]
                        );
                        const questionId = questionResult.rows[0].id;

                        if (question.type === 'choice' && question.options && question.options.length > 0) {
                            for (let k = 0; k < question.options.length; k++) {
                                const option = question.options[k];
                                await client.query(
                                    `INSERT INTO question_options (question_id, label, is_correct, sort_order) VALUES ($1, $2, $3, $4)`,
                                    // Assuming frontend might send 'is_correct', defaulting to false if not
                                    [questionId, option.label, option.is_correct || false, k]
                                );
                            }
                        }
                    }
                }
            }
        }

         // Recalculate estimated duration if not provided initially (optional)
         if (estimatedDuration === null) {
             const calculatedDuration = Math.ceil(lessons.length * 1.5); // Example calculation
             await client.query('UPDATE courses SET estimated_duration = $1 WHERE id = $2', [calculatedDuration, courseId]);
             course.estimated_duration = calculatedDuration; // Update object in memory
         }


        await client.query('COMMIT');

        // Return the newly created course with details
        return await findById(courseId); // Use findById to get formatted data

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating course:", error);
        throw error; // Re-throw the error for the controller
    } finally {
        client.release();
    }
};

/**
 * Обновление курса (только черновика)
 * @param {string} id - ID курса
 * @param {Object} updateData - Данные для обновления
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Обновленный курс
 */
const update = async (id, updateData, authorId) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check if course exists, belongs to author, and is unpublished
        const courseCheck = await client.query(
            'SELECT id, is_published FROM courses WHERE id = $1 AND author_id = $2',
            [id, authorId]
        );
        if (courseCheck.rows.length === 0) {
            throw new Error('Course not found or not authorized');
        }
        if (courseCheck.rows[0].is_published) {
            throw new Error('Cannot update published course');
        }

        const {
            title, description, difficulty, language, tags, lessons, // Expect full lessons array for update
            coverUrl, estimatedDuration
        } = updateData;

        // 2. Update basic course fields
        const updateFields = [];
        const values = [];
        let counter = 1;

        // Helper to add field to update query
        const addUpdateField = (field, value) => {
            if (value !== undefined) {
                updateFields.push(`${field} = $${counter}`);
                values.push(value);
                counter++;
            }
        };

        addUpdateField('title', title);
        addUpdateField('description', description);
        addUpdateField('difficulty', difficulty);
        addUpdateField('language', language);
        addUpdateField('cover_url', coverUrl);
        addUpdateField('estimated_duration', estimatedDuration);

        if (updateFields.length > 0) {
            values.push(id); // Add course ID for WHERE clause
            await client.query(
                `UPDATE courses SET ${updateFields.join(', ')} WHERE id = $${counter}`,
                values
            );
        }

        // 3. Update tags (delete existing, insert new)
        if (tags !== undefined) {
            await client.query('DELETE FROM course_tags WHERE course_id = $1', [id]);
            if (tags.length > 0) {
                const tagValues = tags.map((tag, index) => `($1, $${index + 2})`).join(', ');
                const tagParams = [id, ...tags];
                await client.query(`INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`, tagParams);
            }
        }

        // 4. Update lessons (complex: delete old, insert/update new)
        if (lessons !== undefined) {
             // Get IDs of lessons currently associated with the course
             const existingLessonsResult = await client.query('SELECT id FROM lessons WHERE course_id = $1', [id]);
             const existingLessonIds = new Set(existingLessonsResult.rows.map(r => r.id));
             const updatedLessonIds = new Set();

             // Iterate through lessons provided in the update
            for (let i = 0; i < lessons.length; i++) {
                const lesson = lessons[i];
                let lessonId = lesson.id; // Use provided ID if exists

                 if (lessonId && existingLessonIds.has(lessonId)) {
                     // Update existing lesson
                    await client.query(
                        'UPDATE lessons SET title = $1, type = $2, sort_order = $3 WHERE id = $4',
                        [lesson.title, lesson.type, i, lessonId]
                    );
                    updatedLessonIds.add(lessonId);
                 } else {
                     // Insert new lesson (ignore any incoming ID if it wasn't existing)
                    const newLessonResult = await client.query(
                        'INSERT INTO lessons (course_id, title, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
                        [id, lesson.title, lesson.type, i]
                    );
                    lessonId = newLessonResult.rows[0].id; // Get the newly generated ID
                    updatedLessonIds.add(lessonId);
                 }

                 // Update lesson content (upsert logic)
                await client.query(
                    `INSERT INTO lesson_content (lesson_id, content, video_url) VALUES ($1, $2, $3)
                     ON CONFLICT (lesson_id) DO UPDATE SET content = EXCLUDED.content, video_url = EXCLUDED.video_url`,
                    [lessonId, lesson.content || '', lesson.videoUrl || null]
                );

                 // Update quiz (delete all old questions for this lesson, insert new)
                await client.query('DELETE FROM questions WHERE lesson_id = $1', [lessonId]);
                if (lesson.quiz && lesson.quiz.length > 0) {
                    for (let j = 0; j < lesson.quiz.length; j++) {
                        const question = lesson.quiz[j];
                        const questionResult = await client.query(
                            'INSERT INTO questions (lesson_id, text, type, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
                            [lessonId, question.text, question.type, j]
                        );
                        const questionId = questionResult.rows[0].id;

                        if (question.type === 'choice' && question.options && question.options.length > 0) {
                            for (let k = 0; k < question.options.length; k++) {
                                const option = question.options[k];
                                await client.query(
                                    'INSERT INTO question_options (question_id, label, is_correct, sort_order) VALUES ($1, $2, $3, $4)',
                                    [questionId, option.label, option.is_correct || false, k]
                                );
                            }
                        }
                    }
                }
            }

            // Delete lessons that were previously associated but are not in the updated list
            for (const existingId of existingLessonIds) {
                if (!updatedLessonIds.has(existingId)) {
                    await client.query('DELETE FROM lessons WHERE id = $1', [existingId]);
                }
            }

             // Optional: Recalculate estimated duration based on new lesson count if not explicitly set
             if (estimatedDuration === undefined) { // Only if duration wasn't part of the updateData
                 const newDuration = Math.ceil(lessons.length * 1.5);
                 await client.query('UPDATE courses SET estimated_duration = $1 WHERE id = $2', [newDuration, id]);
             }
        }


        await client.query('COMMIT');

        // Return the updated course details
        return await findById(id);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating course:", error);
        throw error; // Re-throw for controller
    } finally {
        client.release();
    }
};

/**
 * Публикация курса (увеличивает версию)
 * @param {string} id - ID курса
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Опубликованный курс
 */
const publish = async (id, authorId) => {
    // 1. Check if course exists and belongs to the author
    const courseCheck = await db.query(
        'SELECT id FROM courses WHERE id = $1 AND author_id = $2',
        [id, authorId]
    );
    if (courseCheck.rows.length === 0) {
        throw new Error('Course not found or not authorized');
    }

    // 2. Update course: set is_published = true, increment version
    // NOTE: In a real system, publishing might involve creating a *new* course record
    // with the incremented version, keeping the old one immutable.
    // This simplified version updates the existing record.
    const result = await db.query(
        'UPDATE courses SET is_published = true, version = version + 1 WHERE id = $1 RETURNING id',
        [id]
    );

    // 3. Return the newly published course details
    return await findById(id);
};

/**
 * Получение курсов по ID автора
 * @param {string} authorId - ID автора
 * @returns {Promise<Array>} - Массив курсов автора
 */
const findByAuthor = async (authorId) => {
    const query = `
      SELECT
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
        COALESCE(cs.avg_score, 0) AS avg_score
      FROM
        courses c
      JOIN
        users u ON c.author_id = u.id
      LEFT JOIN
        course_stats cs ON c.id = cs.course_id
      WHERE
        c.author_id = $1
      ORDER BY
        c.created_at DESC;
    `;

    const result = await db.query(query, [authorId]);

    // Get tags and lessons for each course
    const courses = await Promise.all(result.rows.map(async courseRow => {
        const tags = await getCourseTags(courseRow.id);
        const lessons = await getCourseLessons(courseRow.id);
        return formatCourseData(courseRow, tags, lessons);
    }));

    return courses;
};

/**
 * Получение всех уникальных тегов из опубликованных курсов
 * @returns {Promise<Array<string>>} - Массив уникальных тегов
 */
const findAllUniqueTags = async () => {
    const query = `
        SELECT DISTINCT ct.tag
        FROM course_tags ct
        JOIN courses c ON ct.course_id = c.id
        WHERE c.is_published = true
        ORDER BY ct.tag;
    `;
    const result = await db.query(query);
    return result.rows.map(row => row.tag);
};


// --- IMPORTANT: Define ALL functions before exporting ---

module.exports = {
    findAll,
    findById, // Ensure this is defined ABOVE this line
    create,
    update,
    publish,
    findByAuthor,
    findAllUniqueTags, // <-- ADDED EXPORT
    // Export helpers ONLY if they are needed by other models (like Enrollment.js)
    getCourseTags,
    getCourseLessons,
    formatCourseData
};