/**
 * Скрипт для заполнения базы данных тестовыми данными
 * Запуск: node scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Тестовые данные
const users = [
  {
    email: 'ivan@example.com',
    password: 'password',
    fullName: 'Иван Иванов',
  },
  {
    email: 'polina@example.com',
    password: 'password',
    fullName: 'Полина Смирнова',
  },
  {
    email: 'user@example.com',
    password: 'password',
    fullName: 'Тестовый Пользователь',
  }
];

const courses = [
  {
    title: 'Подготовка к Python Middle собеседованию',
    description: 'Полноценный курс для подготовки к Python Middle собеседованиям.',
    difficulty: 'Middle',
    language: 'Python',
    coverUrl: '/images/courses/python.png',
    tags: ['Python', 'Backend', 'Algorithms'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы Python', type: 'Theory', hasQuiz: true },
      { title: 'Структуры данных', type: 'Theory', hasQuiz: true },
      { title: 'Алгоритмы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    title: 'Алгоритмы и структуры данных для собеседований',
    description: 'Разбор алгоритмов и структур данных, которые часто спрашивают на собеседованиях.',
    difficulty: 'Middle',
    language: 'JavaScript',
    coverUrl: '/images/courses/algos.png',
    tags: ['Algorithms', 'Data Structures', 'Leetcode'],
    authorIndex: 1,
    lessons: [
      { title: 'Сложность алгоритмов', type: 'Theory', hasQuiz: true },
      { title: 'Сортировки', type: 'Coding', hasQuiz: true },
      { title: 'Деревья и графы', type: 'Theory', hasQuiz: true }
    ]
  },
  {
    title: 'Интервью аналитика: SQL, Excel, кейсы',
    description: 'Всё, что нужно для успешного прохождения собеседования на позицию аналитика.',
    difficulty: 'Beginner',
    language: 'SQL',
    coverUrl: '/images/courses/anal.png',
    tags: ['SQL', 'Analytics', 'Excel'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы SQL', type: 'Theory', hasQuiz: true },
      { title: 'Сложные запросы', type: 'Coding', hasQuiz: true },
      { title: 'Аналитические кейсы', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    title: 'Расскажи о себе: soft skills на собеседовании',
    description: 'Как успешно презентовать себя и свои навыки на собеседовании.',
    difficulty: 'Beginner',
    language: 'Русский',
    coverUrl: '/images/courses/softs.png',
    tags: ['Soft skills', 'HR', 'Interview'],
    authorIndex: 1,
    lessons: [
      { title: 'Самопрезентация', type: 'Theory', hasQuiz: true },
      { title: 'Сложные вопросы', type: 'Theory', hasQuiz: true },
      { title: 'Обратная связь', type: 'Theory', hasQuiz: false }
    ]
  },
  {
    title: 'System Design для Senior',
    description: 'Подготовка к вопросам по системному дизайну для позиции Senior Developer.',
    difficulty: 'Senior',
    language: 'English',
    coverUrl: '/images/courses/sysdis.png',
    tags: ['System Design', 'Architecture', 'Senior'],
    authorIndex: 0,
    lessons: [
      { title: 'Основы системного дизайна', type: 'Theory', hasQuiz: true },
      { title: 'Масштабирование', type: 'Theory', hasQuiz: true },
      { title: 'Практические кейсы', type: 'Coding', hasQuiz: true }
    ]
  },
  {
    title: 'JavaScript для Junior Frontend',
    description: 'Всё, что нужно знать Junior Frontend разработчику о JavaScript.',
    difficulty: 'Beginner',
    language: 'JavaScript',
    coverUrl: '/images/courses/js.png',
    tags: ['JavaScript', 'Frontend', 'Web'],
    authorIndex: 1,
    lessons: [
      { title: 'Основы JavaScript', type: 'Theory', hasQuiz: true },
      { title: 'DOM манипуляции', type: 'Theory', hasQuiz: true },
      { title: 'Асинхронный JavaScript', type: 'Coding', hasQuiz: true }
    ]
  }
];

// Функция для заполнения базы данных
async function seedDatabase() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Очистка таблиц...');
    
    // Используем TRUNCATE с CASCADE вместо DELETE для более надежной очистки
    try {
      // Отключаем проверку внешних ключей на время очистки (опционально)
      // await client.query('SET session_replication_role = replica;');
      
      // Удаляем данные из таблиц, очищая их все за один запрос с учетом зависимостей
      await client.query(`
        TRUNCATE TABLE 
          ratings, 
          enrollments, 
          lesson_progress, 
          question_options, 
          questions, 
          lesson_content, 
          lessons, 
          course_tags, 
          course_stats, 
          courses, 
          user_stats, 
          users
        CASCADE;
      `);
      
      // Восстанавливаем проверку внешних ключей (если отключали)
      // await client.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Ошибка при очистке таблиц:', error);
      throw error;
    }
    
    console.log('Создание пользователей...');
    
    // Создаем пользователей
    const createdUserIds = [];
    
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const result = await client.query(
        `INSERT INTO users (email, password, full_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [user.email, hashedPassword, user.fullName]
      );
      
      const userId = result.rows[0].id;
      createdUserIds.push(userId);
      
      await client.query(
        `INSERT INTO user_stats (user_id, active_courses, completed_courses, avg_score) 
         VALUES ($1, $2, $3, $4)`,
        [userId, 0, 0, 0]
      );
    }
    
    console.log('Создание курсов...');
    
    // Создаем курсы
    for (const course of courses) {
      const authorId = createdUserIds[course.authorIndex];
      
      const result = await client.query(
        `INSERT INTO courses 
           (author_id, title, description, difficulty, language, cover_url, estimated_duration, version, is_published) 
         VALUES 
           ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [authorId, course.title, course.description, course.difficulty, course.language, 
         course.coverUrl, course.lessons.length * 2, 1, true]
      );
      
      const courseId = result.rows[0].id;
      
      // Добавляем статистику курса
      await client.query(
        `INSERT INTO course_stats 
           (course_id, enrollments, avg_completion, avg_score) 
         VALUES 
           ($1, $2, $3, $4)`,
        [courseId, Math.floor(Math.random() * 300), Math.floor(Math.random() * 40) + 60, (Math.random() * 1.5) + 3.5]
      );
      
      // Добавляем теги
      for (const tag of course.tags) {
        await client.query(
          `INSERT INTO course_tags (course_id, tag) VALUES ($1, $2)`,
          [courseId, tag]
        );
      }
      
      // Добавляем уроки
      for (let i = 0; i < course.lessons.length; i++) {
        const lesson = course.lessons[i];
        
        const lessonResult = await client.query(
          `INSERT INTO lessons 
             (course_id, title, type, sort_order) 
           VALUES 
             ($1, $2, $3, $4) 
           RETURNING id`,
          [courseId, lesson.title, lesson.type, i]
        );
        
        const lessonId = lessonResult.rows[0].id;
        
        // Добавляем содержимое урока
        await client.query(
          `INSERT INTO lesson_content 
             (lesson_id, content, video_url) 
           VALUES 
             ($1, $2, $3)`,
          [lessonId, `# ${lesson.title}\n\nЭто содержимое урока ${lesson.title} курса ${course.title}.`, null]
        );
        
        // Добавляем вопросы для квиза
        if (lesson.hasQuiz) {
          for (let j = 0; j < 3; j++) {
            const questionResult = await client.query(
              `INSERT INTO questions 
                 (lesson_id, text, type, sort_order) 
               VALUES 
                 ($1, $2, $3, $4) 
               RETURNING id`,
              [lessonId, `Вопрос ${j+1} для урока ${lesson.title}`, j === 0 ? 'choice' : (j === 1 ? 'shortText' : 'longText'), j]
            );
            
            const questionId = questionResult.rows[0].id;
            
            // Добавляем варианты ответов для вопросов с выбором
            if (j === 0) {
              for (let k = 0; k < 4; k++) {
                await client.query(
                  `INSERT INTO question_options 
                     (question_id, label, is_correct, sort_order) 
                   VALUES 
                     ($1, $2, $3, $4)`,
                  [questionId, `Вариант ${k+1}`, k === 0, k]
                );
              }
            }
          }
        }
      }
      
      console.log(`Создан курс: ${course.title}`);
    }
    
    console.log('Создание записей на курсы...');
    
    // Записываем обычного пользователя на несколько курсов
    const userId = createdUserIds[2]; // ID обычного пользователя
    
    // Получаем курсы
    const coursesResult = await client.query('SELECT id FROM courses LIMIT 3');
    const courseIds = coursesResult.rows.map(row => row.id);
    
    // Записываем на курсы
    for (let i = 0; i < courseIds.length; i++) {
      const courseId = courseIds[i];
      
      await client.query(
        `INSERT INTO enrollments 
           (user_id, course_id, status, progress, started_at) 
         VALUES 
           ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, courseId, i === 0 ? 'completed' : 'inProgress', i === 0 ? 100 : Math.floor(Math.random() * 70)]
      );
      
      // Обновляем статистику
      await client.query(
        `UPDATE user_stats 
         SET active_courses = active_courses + CASE WHEN $1 = 'inProgress' THEN 1 ELSE 0 END,
             completed_courses = completed_courses + CASE WHEN $1 = 'completed' THEN 1 ELSE 0 END 
         WHERE user_id = $2`,
        [i === 0 ? 'completed' : 'inProgress', userId]
      );
      
      await client.query(
        `UPDATE course_stats 
         SET enrollments = enrollments + 1 
         WHERE course_id = $1`,
        [courseId]
      );
      
      // Оцениваем законченный курс
      if (i === 0) {
        await client.query(
          `INSERT INTO ratings 
             (user_id, course_id, value, created_at) 
           VALUES 
             ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [userId, courseId, 5]
        );
        
        // Обновляем среднюю оценку курса
        await client.query(
          `UPDATE course_stats 
           SET avg_score = 
             (SELECT AVG(value)::numeric(5,2) FROM ratings WHERE course_id = $1) 
           WHERE course_id = $1`,
          [courseId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    console.log('База данных успешно заполнена тестовыми данными!');
    console.log('\nДанные для входа:');
    for (const user of users) {
      console.log(`- ${user.email}: ${user.password}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при заполнении базы данных:', error);
  } finally {
    client.release();
    // Закрываем пул соединений
    db.pool.end();
  }
}

// Запускаем заполнение
seedDatabase();