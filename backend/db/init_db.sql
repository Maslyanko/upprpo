-- ===================================================================
-- 1. Создание базы данных и подключение
-- ===================================================================

-- DROP DATABASE IF EXISTS offer_hunt; -- Раскомментировать, если нужно пересоздать
CREATE DATABASE offer_hunt;
\connect offer_hunt;

-- ===================================================================
-- 2. Расширения
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 3. Создание таблиц
-- ===================================================================

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица статистики пользователей (user_stats) -- УДАЛЕНА
-- Статистика будет рассчитываться динамически

-- Таблица тегов
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL, -- Уникальное имя тега, например "Python", "Beginner"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- updated_at не нужен, теги обычно не меняют имя, а создаются/удаляются
);

-- Таблица курсов
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  -- difficulty VARCHAR(50) NOT NULL, -- УДАЛЕНО, будет через теги
  -- language VARCHAR(100), -- УДАЛЕНО, будет через теги
  cover_url VARCHAR(512) DEFAULT '/images/courses/default.png',
  estimated_duration INT DEFAULT 0, -- в часах или минутах, уточнить единицу
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица связи курсов и тегов (многие-ко-многим)
CREATE TABLE IF NOT EXISTS course_tags (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, tag_id)
);

-- Таблица статистики курсов
CREATE TABLE IF NOT EXISTS course_stats (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  enrollments INT DEFAULT 0,
  avg_completion DECIMAL(5,2) DEFAULT 0, -- средний процент прохождения курса
  avg_rating DECIMAL(3,2) DEFAULT 0, -- средняя оценка курса пользователями (было avg_score)
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Примечание: avg_score в course_stats переименован в avg_rating для ясности, т.к. score часто ассоциируется с баллами за задания.

-- Таблица уроков
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT, -- ДОБАВЛЕНО описание урока
  -- type VARCHAR(50) NOT NULL, -- УДАЛЕНО, тип определяется страницами урока
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица страниц урока
CREATE TABLE IF NOT EXISTS lesson_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  page_type VARCHAR(50) NOT NULL CHECK (page_type IN ('METHODICAL', 'ASSIGNMENT')), -- Тип страницы
  sort_order INT NOT NULL DEFAULT 0, -- Порядок страницы внутри урока
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица содержимого методических страниц урока
CREATE TABLE IF NOT EXISTS methodical_page_content (
  page_id UUID PRIMARY KEY REFERENCES lesson_pages(id) ON DELETE CASCADE, -- Связь с lesson_pages
  content TEXT, -- Markdown содержимое
  -- video_url VARCHAR(512), -- УДАЛЕНО, видео можно встроить в Markdown
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- CONSTRAINT fk_methodical_page CHECK ( (SELECT page_type FROM lesson_pages WHERE id = page_id) = 'METHODICAL' ) -- Опционально, для строгой проверки
);

-- Таблица вопросов (для страниц типа 'ASSIGNMENT')
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES lesson_pages(id) ON DELETE CASCADE, -- Связь с lesson_pages (типа 'ASSIGNMENT')
  text TEXT NOT NULL, -- Описание задания/вопроса
  type VARCHAR(50) NOT NULL, -- Тип вопроса: SINGLE_CHOICE, MULTIPLE_CHOICE, TEXT_INPUT, CODE_INPUT и т.д.
  sort_order INT NOT NULL DEFAULT 0, -- Порядок вопроса на странице задания
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- ДОБАВЛЕНО updated_at для вопросов
  -- CONSTRAINT fk_assignment_page CHECK ( (SELECT page_type FROM lesson_pages WHERE id = page_id) = 'ASSIGNMENT' ) -- Опционально
);

-- Таблица вариантов ответов
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
  -- created_at и updated_at здесь обычно не нужны, т.к. варианты создаются вместе с вопросом
);

-- Таблица записей на курсы
CREATE TABLE IF NOT EXISTS enrollments (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'inProgress' CHECK (status IN ('inProgress', 'completed', 'dropped')),
  progress DECIMAL(5,2) NOT NULL DEFAULT 0, -- Прогресс от 0 до 100
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
);

-- Таблица оценок курсов (рейтинги)
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value >= 1 AND value <= 5),
  comment TEXT, -- Опционально, комментарий к оценке
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Если оценка может быть изменена
  PRIMARY KEY (user_id, course_id)
);

-- Таблица прогресса по урокам (или теперь по страницам/вопросам)
-- Эта таблица становится сложнее. Прогресс по уроку теперь - это совокупность прогресса по его страницам.
-- Если нужен детальный прогресс по каждому вопросу, то нужна таблица user_question_answers.
-- lesson_progress может отслеживать завершенность урока в целом.
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  -- page_id UUID REFERENCES lesson_pages(id) ON DELETE CASCADE, -- Если прогресс по страницам
  status VARCHAR(50) DEFAULT 'notStarted' CHECK (status IN ('notStarted', 'inProgress', 'completed')),
  score DECIMAL(5,2), -- Общий балл за урок, если применимо
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id) -- Или (user_id, page_id)
);
-- Примечание: Таблица lesson_progress может потребовать дальнейшей детализации
-- в зависимости от того, как вы хотите отслеживать прогресс (по урокам, по страницам, по вопросам).
-- Для простоты пока оставим по урокам, но с пониманием, что 'completed' урока означает прохождение всех его страниц.

-- ===================================================================
-- 4. Триггеры для автоматического обновления updated_at
-- ===================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_courses_modtime
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_course_stats_modtime
BEFORE UPDATE ON course_stats
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_lessons_modtime
BEFORE UPDATE ON lessons
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_lesson_pages_modtime  -- НОВЫЙ ТРИГГЕР
BEFORE UPDATE ON lesson_pages
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_methodical_page_content_modtime -- ИЗМЕНЕННЫЙ ТРИГГЕР (был lesson_content)
BEFORE UPDATE ON methodical_page_content
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_questions_modtime -- НОВЫЙ ТРИГГЕР (для questions.updated_at)
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_ratings_modtime -- НОВЫЙ ТРИГГЕР (если оценки можно менять)
BEFORE UPDATE ON ratings
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- CREATE TRIGGER update_user_stats_modtime -- УДАЛЕН ТРИГГЕР

-- ===================================================================
-- 5. Представление для полной информации о курсе
-- ===================================================================

CREATE OR REPLACE VIEW course_details AS
SELECT
  c.id,
  c.author_id,
  u.full_name AS author_name,
  c.title,
  c.description,
  -- c.difficulty, -- УДАЛЕНО
  -- c.language, -- УДАЛЕНО
  (SELECT ARRAY_AGG(t.name) FROM tags t JOIN course_tags ct ON t.id = ct.tag_id WHERE ct.course_id = c.id) as tags, -- Агрегируем теги
  c.cover_url,
  c.estimated_duration,
  c.version,
  c.is_published,
  cs.enrollments,
  cs.avg_completion,
  cs.avg_rating, -- Было cs.avg_score
  c.created_at,
  c.updated_at
FROM courses c
JOIN users u ON c.author_id = u.id
LEFT JOIN course_stats cs ON c.id = cs.course_id;

-- ===================================================================
-- 6. Создание пользователя и выдача прав (без изменений)
-- ===================================================================

CREATE USER offeruser WITH ENCRYPTED PASSWORD 'offerpassword';

GRANT ALL PRIVILEGES ON DATABASE offer_hunt TO offeruser;
GRANT ALL ON SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO offeruser;

-- Конкретные таблицы (необязательно, но для явности)
GRANT ALL PRIVILEGES ON TABLE users TO offeruser;
-- GRANT ALL PRIVILEGES ON TABLE user_stats TO offeruser; -- УДАЛЕНО
GRANT ALL PRIVILEGES ON TABLE tags TO offeruser; -- ДОБАВЛЕНО
GRANT ALL PRIVILEGES ON TABLE courses TO offeruser;
GRANT ALL PRIVILEGES ON TABLE course_tags TO offeruser;
GRANT ALL PRIVILEGES ON TABLE course_stats TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lessons TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lesson_pages TO offeruser; -- ДОБАВЛЕНО
GRANT ALL PRIVILEGES ON TABLE methodical_page_content TO offeruser; -- ИЗМЕНЕНО (было lesson_content)
GRANT ALL PRIVILEGES ON TABLE questions TO offeruser;
GRANT ALL PRIVILEGES ON TABLE question_options TO offeruser;
GRANT ALL PRIVILEGES ON TABLE enrollments TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lesson_progress TO offeruser;
GRANT ALL PRIVILEGES ON TABLE ratings TO offeruser;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO offeruser;