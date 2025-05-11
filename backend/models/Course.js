const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Получение всех курсов с фильтрацией
 * @param {Object} filters - Параметры фильтрации
 * @returns {Promise<Array>} - Массив курсов
 */
const findAll = async (filters = {}) => {
  const { search, difficulty, sort, tags = [] } = filters;
  
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
  
  // Фильтрация по опубликованным курсам (по умолчанию)
  whereConditions.push(`c.is_published = true`);
  
  // Поиск по тексту
  if (search) {
    whereConditions.push(`(
      c.title ILIKE $${valueCounter} 
      OR u.full_name ILIKE $${valueCounter} 
      OR EXISTS (
        SELECT 1 FROM course_tags ct 
        WHERE ct.course_id = c.id AND ct.tag ILIKE $${valueCounter}
      )
    )`);
    values.push(`%${search}%`);
    valueCounter++;
  }
  
  // Фильтрация по сложности
  if (difficulty) {
    whereConditions.push(`c.difficulty = $${valueCounter}`);
    values.push(difficulty);
    valueCounter++;
  }
  
  // Фильтрация по тегам
  if (tags.length > 0) {
    const placeholders = tags.map((_, idx) => `$${valueCounter + idx}`).join(', ');
    whereConditions.push(`EXISTS (
      SELECT 1 FROM course_tags ct 
      WHERE ct.course_id = c.id AND ct.tag IN (${placeholders})
    )`);
    values.push(...tags);
    valueCounter += tags.length;
  }
  
  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  // Сортировка
  if (sort) {
    switch (sort) {
      case 'popularity':
        query += ` ORDER BY enrollments DESC`;
        break;
      case 'difficulty':
        query += ` ORDER BY CASE 
          WHEN c.difficulty = 'Beginner' THEN 1 
          WHEN c.difficulty = 'Middle' THEN 2 
          WHEN c.difficulty = 'Senior' THEN 3 
          ELSE 4 
        END`;
        break;
      case 'duration':
        query += ` ORDER BY c.estimated_duration DESC`;
        break;
      default:
        query += ` ORDER BY c.created_at DESC`;
    }
  } else {
    query += ` ORDER BY c.created_at DESC`;
  }
  
  const result = await db.query(query, values);
  
  // Получаем теги для каждого курса
  const courses = await Promise.all(result.rows.map(async course => {
    const tags = await getCourseTags(course.id);
    const lessons = await getCourseLessons(course.id);
    
    return formatCourseData(course, tags, lessons);
  }));
  
  return courses;
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
  }
  
  const result = await db.query(query, values);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const course = result.rows[0];
  const tags = await getCourseTags(id);
  const lessons = await getCourseLessons(id);
  
  return formatCourseData(course, tags, lessons);
};

/**
 * Создание нового курса
 * @param {Object} courseData - Данные курса
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Созданный курс
 */
const create = async (courseData, authorId) => {
  const { title, description, difficulty, language, tags = [], lessons = [] } = courseData;
  
  // Транзакция для создания курса и связанных данных
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Создаем курс
    const courseResult = await client.query(
      `INSERT INTO courses 
        (author_id, title, description, difficulty, language, version, is_published) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [authorId, title, description, difficulty, language, 1, false]
    );
    
    const course = courseResult.rows[0];
    
    // Создаем начальную статистику курса
    await client.query(
      `INSERT INTO course_stats 
        (course_id, enrollments, avg_completion, avg_score) 
       VALUES 
        ($1, $2, $3, $4)`,
      [course.id, 0, 0, 0]
    );
    
    // Добавляем теги
    if (tags.length > 0) {
      const tagValues = tags.map(tag => `('${course.id}', '${tag}')`).join(', ');
      await client.query(
        `INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`
      );
    }
    
    // Добавляем уроки
    if (lessons.length > 0) {
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        
        // Создаем урок
        const lessonResult = await client.query(
          `INSERT INTO lessons 
            (course_id, title, type, sort_order) 
           VALUES 
            ($1, $2, $3, $4) 
           RETURNING *`,
          [course.id, lesson.title, lesson.type, i]
        );
        
        const createdLesson = lessonResult.rows[0];
        
        // Добавляем содержимое урока
        if (lesson.content) {
          await client.query(
            `INSERT INTO lesson_content 
              (lesson_id, content, video_url) 
             VALUES 
              ($1, $2, $3)`,
            [createdLesson.id, lesson.content, lesson.videoUrl || null]
          );
        }
        
        // Добавляем вопросы для квиза
        if (lesson.quiz && lesson.quiz.length > 0) {
          for (let j = 0; j < lesson.quiz.length; j++) {
            const question = lesson.quiz[j];
            
            // Создаем вопрос
            const questionResult = await client.query(
              `INSERT INTO questions 
                (lesson_id, text, type, sort_order) 
               VALUES 
                ($1, $2, $3, $4) 
               RETURNING *`,
              [createdLesson.id, question.text, question.type, j]
            );
            
            const createdQuestion = questionResult.rows[0];
            
            // Добавляем варианты ответов для вопросов с выбором
            if (question.type === 'choice' && question.options && question.options.length > 0) {
              for (let k = 0; k < question.options.length; k++) {
                const option = question.options[k];
                
                await client.query(
                  `INSERT INTO question_options 
                    (question_id, label, sort_order) 
                   VALUES 
                    ($1, $2, $3)`,
                  [createdQuestion.id, option.label, k]
                );
              }
            }
          }
        }
      }
    }
    
    // Обновляем estimated_duration на основе количества уроков
    const estimatedDuration = Math.ceil(lessons.length * 2); // Примерно 2 часа на урок
    
    await client.query(
      `UPDATE courses SET estimated_duration = $1 WHERE id = $2`,
      [estimatedDuration, course.id]
    );
    
    await client.query('COMMIT');
    
    // Получаем полную информацию о курсе
    return await findById(course.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Обновление курса
 * @param {string} id - ID курса
 * @param {Object} updateData - Данные для обновления
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Обновленный курс
 */
const update = async (id, updateData, authorId) => {
  // Проверяем, существует ли курс и принадлежит ли он автору
  const existingCourse = await db.query(
    'SELECT * FROM courses WHERE id = $1 AND author_id = $2',
    [id, authorId]
  );
  
  if (existingCourse.rows.length === 0) {
    throw new Error('Course not found or not authorized');
  }
  
  const course = existingCourse.rows[0];
  
  // Проверяем, опубликован ли курс
  if (course.is_published) {
    throw new Error('Cannot update published course');
  }
  
  const { title, description, difficulty, language, tags, lessons } = updateData;
  
  // Транзакция для обновления курса и связанных данных
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Обновляем основные данные курса
    const updateFields = [];
    const values = [];
    let counter = 1;
    
    if (title !== undefined) {
      updateFields.push(`title = $${counter}`);
      values.push(title);
      counter++;
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${counter}`);
      values.push(description);
      counter++;
    }
    
    if (difficulty !== undefined) {
      updateFields.push(`difficulty = $${counter}`);
      values.push(difficulty);
      counter++;
    }
    
    if (language !== undefined) {
      updateFields.push(`language = $${counter}`);
      values.push(language);
      counter++;
    }
    
    if (updateFields.length > 0) {
      values.push(id);
      
      await client.query(
        `UPDATE courses SET ${updateFields.join(', ')} WHERE id = $${counter}`,
        values
      );
    }
    
    // Обновляем теги
    if (tags !== undefined) {
      // Удаляем существующие теги
      await client.query('DELETE FROM course_tags WHERE course_id = $1', [id]);
      
      // Добавляем новые теги
      if (tags.length > 0) {
        const tagValues = tags.map(tag => `('${id}', '${tag}')`).join(', ');
        await client.query(
          `INSERT INTO course_tags (course_id, tag) VALUES ${tagValues}`
        );
      }
    }
    
    // Обновляем уроки
    if (lessons !== undefined) {
      // Получаем существующие уроки
      const existingLessons = await client.query(
        'SELECT id FROM lessons WHERE course_id = $1',
        [id]
      );
      
      const existingLessonIds = existingLessons.rows.map(row => row.id);
      
      // Создаем или обновляем уроки
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        
        if (lesson.id && existingLessonIds.includes(lesson.id)) {
          // Обновляем существующий урок
          await client.query(
            'UPDATE lessons SET title = $1, type = $2, sort_order = $3 WHERE id = $4',
            [lesson.title, lesson.type, i, lesson.id]
          );
          
          // Удаляем из списка существующих уроков
          const index = existingLessonIds.indexOf(lesson.id);
          if (index > -1) {
            existingLessonIds.splice(index, 1);
          }
          
          // Обновляем содержимое урока
          if (lesson.content !== undefined) {
            const contentExists = await client.query(
              'SELECT 1 FROM lesson_content WHERE lesson_id = $1',
              [lesson.id]
            );
            
            if (contentExists.rows.length > 0) {
              await client.query(
                'UPDATE lesson_content SET content = $1, video_url = $2 WHERE lesson_id = $3',
                [lesson.content, lesson.videoUrl || null, lesson.id]
              );
            } else {
              await client.query(
                'INSERT INTO lesson_content (lesson_id, content, video_url) VALUES ($1, $2, $3)',
                [lesson.id, lesson.content, lesson.videoUrl || null]
              );
            }
          }
          
          // Обновляем вопросы (удаляем старые и добавляем новые)
          if (lesson.quiz !== undefined) {
            await client.query('DELETE FROM questions WHERE lesson_id = $1', [lesson.id]);
            
            if (lesson.quiz && lesson.quiz.length > 0) {
              for (let j = 0; j < lesson.quiz.length; j++) {
                const question = lesson.quiz[j];
                
                // Создаем вопрос
                const questionResult = await client.query(
                  `INSERT INTO questions 
                    (lesson_id, text, type, sort_order) 
                   VALUES 
                    ($1, $2, $3, $4) 
                   RETURNING *`,
                  [lesson.id, question.text, question.type, j]
                );
                
                const createdQuestion = questionResult.rows[0];
                
                // Добавляем варианты ответов для вопросов с выбором
                if (question.type === 'choice' && question.options && question.options.length > 0) {
                  for (let k = 0; k < question.options.length; k++) {
                    const option = question.options[k];
                    
                    await client.query(
                      `INSERT INTO question_options 
                        (question_id, label, sort_order) 
                       VALUES 
                        ($1, $2, $3)`,
                      [createdQuestion.id, option.label, k]
                    );
                  }
                }
              }
            }
          }
        } else {
          // Создаем новый урок
          const lessonResult = await client.query(
            `INSERT INTO lessons 
              (course_id, title, type, sort_order) 
             VALUES 
              ($1, $2, $3, $4) 
             RETURNING *`,
            [id, lesson.title, lesson.type, i]
          );
          
          const createdLesson = lessonResult.rows[0];
          
          // Добавляем содержимое урока
          if (lesson.content) {
            await client.query(
              `INSERT INTO lesson_content 
                (lesson_id, content, video_url) 
               VALUES 
                ($1, $2, $3)`,
              [createdLesson.id, lesson.content, lesson.videoUrl || null]
            );
          }
          
          // Добавляем вопросы для квиза
          if (lesson.quiz && lesson.quiz.length > 0) {
            for (let j = 0; j < lesson.quiz.length; j++) {
              const question = lesson.quiz[j];
              
              // Создаем вопрос
              const questionResult = await client.query(
                `INSERT INTO questions 
                  (lesson_id, text, type, sort_order) 
                 VALUES 
                  ($1, $2, $3, $4) 
                 RETURNING *`,
                [createdLesson.id, question.text, question.type, j]
              );
              
              const createdQuestion = questionResult.rows[0];
              
              // Добавляем варианты ответов для вопросов с выбором
              if (question.type === 'choice' && question.options && question.options.length > 0) {
                for (let k = 0; k < question.options.length; k++) {
                  const option = question.options[k];
                  
                  await client.query(
                    `INSERT INTO question_options 
                      (question_id, label, sort_order) 
                     VALUES 
                      ($1, $2, $3)`,
                    [createdQuestion.id, option.label, k]
                  );
                }
              }
            }
          }
        }
      }
      
      // Удаляем уроки, которых нет в обновленном списке
      for (const lessonId of existingLessonIds) {
        await client.query('DELETE FROM lessons WHERE id = $1', [lessonId]);
      }
      
      // Обновляем estimated_duration на основе количества уроков
      const estimatedDuration = Math.ceil(lessons.length * 2); // Примерно 2 часа на урок
      
      await client.query(
        `UPDATE courses SET estimated_duration = $1 WHERE id = $2`,
        [estimatedDuration, id]
      );
    }
    
    await client.query('COMMIT');
    
    // Получаем полную информацию о курсе
    return await findById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Публикация курса
 * @param {string} id - ID курса
 * @param {string} authorId - ID автора
 * @returns {Promise<Object>} - Опубликованный курс
 */
const publish = async (id, authorId) => {
  // Проверяем, существует ли курс и принадлежит ли он автору
  const existingCourse = await db.query(
    'SELECT * FROM courses WHERE id = $1 AND author_id = $2',
    [id, authorId]
  );
  
  if (existingCourse.rows.length === 0) {
    throw new Error('Course not found or not authorized');
  }
  
  const course = existingCourse.rows[0];
  
  // Увеличиваем версию и публикуем курс
  await db.query(
    'UPDATE courses SET is_published = true, version = version + 1 WHERE id = $1',
    [id]
  );
  
  // Получаем обновленный курс
  return await findById(id);
};

/**
 * Получение тегов курса
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив тегов
 */
const getCourseTags = async (courseId) => {
  const result = await db.query(
    'SELECT tag FROM course_tags WHERE course_id = $1',
    [courseId]
  );
  
  return result.rows.map(row => row.tag);
};

/**
 * Получение уроков курса
 * @param {string} courseId - ID курса
 * @returns {Promise<Array>} - Массив уроков
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
  
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    type: row.type,
    hasQuiz: row.has_quiz
  }));
};

/**
 * Форматирование данных курса для API
 * @param {Object} courseData - Данные курса из базы
 * @param {Array} tags - Теги курса
 * @param {Array} lessons - Уроки курса
 * @returns {Object} - Форматированные данные курса
 */
const formatCourseData = (courseData, tags, lessons) => {
  return {
    id: courseData.id,
    authorId: courseData.author_id,
    authorName: courseData.author_name,
    title: courseData.title,
    description: courseData.description,
    difficulty: courseData.difficulty,
    language: courseData.language,
    coverUrl: courseData.cover_url,
    tags: tags,
    estimatedDuration: courseData.estimated_duration,
    version: courseData.version,
    isPublished: courseData.is_published,
    stats: {
      enrollments: parseInt(courseData.enrollments) || 0,
      avgCompletion: parseFloat(courseData.avg_completion) || 0,
      avgScore: parseFloat(courseData.avg_score) || 0
    },
    lessons: lessons
  };
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  publish
};