// ==== File: backend/scripts/seed.js ====
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db'); // Assuming db.pool for client usage
const TagModel = require('../models/Tag'); // To use findOrCreate

// --- Test Data Definitions ---
const usersData = [
  { email: 'ivan@example.com', password: 'password', fullName: 'Иван Иванов' },
  { email: 'polina@example.com', password: 'password', fullName: 'Полина Смирнова' },
  { email: 'user@example.com', password: 'password', fullName: 'Тестовый Пользователь' },
];

const predefinedTags = [
    "Python", "JavaScript", "SQL", "Java", "C++", "Go", "Ruby", "PHP",
    "Beginner", "Middle", "Senior",
    "Backend", "Frontend", "Fullstack", "DevOps", "Data Science", "Machine Learning",
    "Algorithms", "Data Structures", "System Design", "Soft Skills", "Interview Prep",
    "Web Development", "Mobile Development", "Game Development", "Cybersecurity",
    "Cloud Computing", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
    "React", "Angular", "Vue.js", "Node.js", "Django", "Flask", "Spring Boot",
    "Analytics", "Excel", "HR", "Agile", "Scrum", "Product Management"
];


const coursesData = [
  {
    title: 'Подготовка к Python Middle собеседованию',
    description: 'Полноценный курс для подготовки к Python Middle собеседованиям.',
    tags: ['Python', 'Middle', 'Backend', 'Algorithms'], // Tag names
    authorEmail: 'ivan@example.com',
    coverUrl: '/images/courses/python.png',
    estimatedDuration: 20,
    lessons: [
      {
        title: 'Основы Python для Middle', description: 'Ключевые концепции Python.',
        pages: [
          { title: 'Введение в GIL', pageType: 'METHODICAL', content: '# GIL\nGlobal Interpreter Lock...' },
          { title: 'Декораторы', pageType: 'METHODICAL', content: '# Декораторы\nПримеры декораторов...' },
          {
            title: 'Тест по основам', pageType: 'ASSIGNMENT',
            questions: [
              { text: 'Что такое GIL?', type: 'TEXT_INPUT' },
              { text: 'Приведите пример замыкания.', type: 'CODE_INPUT' },
            ]
          }
        ]
      },
      // More lessons
    ]
  },
  // More courses
];


async function seedDatabase() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Очистка таблиц...');
    // Order matters due to FK constraints if not using CASCADE effectively
    await client.query('TRUNCATE TABLE ratings, enrollments, lesson_progress, question_options, questions, methodical_page_content, lesson_pages, lessons, course_tags, course_stats, courses, tags, users CASCADE;');
    console.log('Таблицы очищены.');

    // 1. Seed Tags
    console.log('Создание тегов...');
    const createdTagsMap = new Map(); // name -> id
    for (const tagName of predefinedTags) {
        const tag = await TagModel.findOrCreate(tagName, client);
        createdTagsMap.set(tag.name, tag.id);
    }
    console.log(`${createdTagsMap.size} тегов создано/найдено.`);

    // 2. Seed Users
    console.log('Создание пользователей...');
    const createdUsersMap = new Map(); // email -> id
    for (const userData of usersData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userResult = await client.query(
        'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING id, email',
        [userData.email, hashedPassword, userData.fullName]
      );
      createdUsersMap.set(userResult.rows[0].email, userResult.rows[0].id);
    }
    console.log(`${createdUsersMap.size} пользователей создано.`);

    // 3. Seed Courses, Lessons, Pages, Questions
    console.log('Создание курсов...');
    for (const courseItem of coursesData) {
      const authorId = createdUsersMap.get(courseItem.authorEmail);
      if (!authorId) {
        console.warn(`Автор ${courseItem.authorEmail} не найден для курса ${courseItem.title}. Пропуск курса.`);
        continue;
      }

      // Create Course
      const courseRes = await client.query(
        `INSERT INTO courses (author_id, title, description, cover_url, estimated_duration, version, is_published)
         VALUES ($1, $2, $3, $4, $5, 1, true) RETURNING id`,
        [authorId, courseItem.title, courseItem.description, courseItem.coverUrl, courseItem.estimatedDuration]
      );
      const courseId = courseRes.rows[0].id;

      // Create Course Stats
      await client.query('INSERT INTO course_stats (course_id, enrollments, avg_completion, avg_rating) VALUES ($1, $2, $3, $4)',
        [courseId, Math.floor(Math.random() * 100), Math.random() * 100, (Math.random() * 2 + 3).toFixed(2) ] // Random stats
      );

      // Link Tags to Course
      for (const tagName of courseItem.tags) {
        const tagId = createdTagsMap.get(tagName);
        if (tagId) {
          await client.query('INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [courseId, tagId]);
        } else {
          console.warn(`Тег "${tagName}" не найден в predefinedTags для курса ${courseItem.title}`);
        }
      }

      // Create Lessons
      let lessonSortOrder = 0;
      for (const lessonItem of courseItem.lessons || []) {
        const lessonRes = await client.query(
          `INSERT INTO lessons (course_id, title, description, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [courseId, lessonItem.title, lessonItem.description, lessonSortOrder++]
        );
        const lessonId = lessonRes.rows[0].id;

        // Create Lesson Pages
        let pageSortOrder = 0;
        for (const pageItem of lessonItem.pages || []) {
          const pageRes = await client.query(
            `INSERT INTO lesson_pages (lesson_id, title, page_type, sort_order)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [lessonId, pageItem.title, pageItem.pageType, pageSortOrder++]
          );
          const pageId = pageRes.rows[0].id;

          // Create Methodical Page Content
          if (pageItem.pageType === 'METHODICAL' && pageItem.content) {
            await client.query('INSERT INTO methodical_page_content (page_id, content) VALUES ($1, $2)',
              [pageId, pageItem.content]
            );
          }
          // Create Questions for Assignment Pages
          else if (pageItem.pageType === 'ASSIGNMENT' && pageItem.questions) {
            let questionSortOrder = 0;
            for (const questionItem of pageItem.questions) {
              const questionRes = await client.query(
                `INSERT INTO questions (page_id, text, type, sort_order)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [pageId, questionItem.text, questionItem.type, questionSortOrder++]
              );
              const questionId = questionRes.rows[0].id;

              // Create Question Options
              let optionSortOrder = 0;
              for (const optionItem of questionItem.options || []) {
                await client.query(
                  `INSERT INTO question_options (question_id, label, is_correct, sort_order)
                   VALUES ($1, $2, $3, $4)`,
                  [questionId, optionItem.label, optionItem.isCorrect || false, optionSortOrder++]
                );
              }
            }
          }
        }
      }
      console.log(`Курс "${courseItem.title}" создан.`);
    }

    // 4. Seed Enrollments and Ratings (Example for 'user@example.com')
    const testUserId = createdUsersMap.get('user@example.com');
    if (testUserId) {
        console.log('Создание записей и оценок для user@example.com...');
        const someCoursesRes = await client.query('SELECT id FROM courses WHERE author_id != $1 LIMIT 2', [testUserId]); // Enroll in courses not authored by testUser
        for (const courseRow of someCoursesRes.rows) {
            const courseIdToEnroll = courseRow.id;
            // Enroll
            await client.query(
                `INSERT INTO enrollments (user_id, course_id, status, progress, started_at, finished_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
                [testUserId, courseIdToEnroll, Math.random() > 0.5 ? 'completed' : 'inProgress', Math.random() * 100, Math.random() > 0.5 ? CURRENT_TIMESTAMP : null]
            );
             // Rate if completed
            if (Math.random() > 0.5) { // Simulate some completed courses being rated
                await client.query(
                    `INSERT INTO ratings (user_id, course_id, value, comment)
                     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                    [testUserId, courseIdToEnroll, Math.floor(Math.random() * 3) + 3, 'Отличный курс!']
                );
                // Trigger update of course_stats.avg_rating (could be a trigger in DB too)
                await client.query(
                  `UPDATE course_stats SET avg_rating = (SELECT AVG(value) FROM ratings WHERE course_id = $1) WHERE course_id = $1`,
                  [courseIdToEnroll]
                );
            }
        }
    }


    await client.query('COMMIT');
    console.log('База данных успешно заполнена тестовыми данными!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка при заполнении базы данных:', error);
  } finally {
    client.release();
    db.pool.end(); // Close all connections in the pool
  }
}

seedDatabase();