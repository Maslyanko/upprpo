-- ===================================================================
-- 1. Создание базы данных и подключение
-- ===================================================================

-- Создание базы данных offer_hunt (если нужно пересоздать — добавить DROP DATABASE)
CREATE DATABASE offer_hunt;
-- Подключение к базе данных в psql
\connect offer_hunt;

-- ===================================================================
-- 2. Расширения
-- ===================================================================

-- Расширение для генерации UUID
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

-- Таблица статистики пользователей
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_courses INT DEFAULT 0,
  completed_courses INT DEFAULT 0,
  avg_score DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица курсов
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty VARCHAR(50) NOT NULL,
  language VARCHAR(100),
  cover_url VARCHAR(512) DEFAULT '/images/courses/default.png',
  estimated_duration INT DEFAULT 0,
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица тегов курсов
CREATE TABLE IF NOT EXISTS course_tags (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  PRIMARY KEY (course_id, tag)
);

-- Таблица статистики курсов
CREATE TABLE IF NOT EXISTS course_stats (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  enrollments INT DEFAULT 0,
  avg_completion DECIMAL(5,2) DEFAULT 0,
  avg_score DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица уроков
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица содержимого уроков
CREATE TABLE IF NOT EXISTS lesson_content (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT,
  video_url VARCHAR(512),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица вопросов
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица вариантов ответов
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

-- Таблица записей на курсы
CREATE TABLE IF NOT EXISTS enrollments (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'inProgress',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
);

-- Таблица оценок курсов
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value >= 1 AND value <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
);

-- Таблица прогресса по урокам
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  score DECIMAL(5,2),
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
);

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

CREATE TRIGGER update_lessons_modtime
BEFORE UPDATE ON lessons
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_lesson_content_modtime
BEFORE UPDATE ON lesson_content
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_user_stats_modtime
BEFORE UPDATE ON user_stats
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_course_stats_modtime
BEFORE UPDATE ON course_stats
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

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
  c.difficulty, 
  c.language, 
  c.cover_url, 
  c.estimated_duration, 
  c.version, 
  c.is_published,
  cs.enrollments, 
  cs.avg_completion, 
  cs.avg_score,
  c.created_at,
  c.updated_at
FROM courses c
JOIN users u ON c.author_id = u.id
LEFT JOIN course_stats cs ON c.id = cs.course_id;

-- ===================================================================
-- 6. Создание пользователя и выдача прав
-- ===================================================================

CREATE USER offeruser WITH ENCRYPTED PASSWORD 'offerpassword';

-- Права на саму базу
GRANT ALL PRIVILEGES ON DATABASE offer_hunt TO offeruser;

-- Права на схему и ее объекты
GRANT ALL ON SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO offeruser;

-- Конкретные таблицы (необязательно, но для явности)
GRANT ALL PRIVILEGES ON TABLE users TO offeruser;
GRANT ALL PRIVILEGES ON TABLE user_stats TO offeruser;
GRANT ALL PRIVILEGES ON TABLE courses TO offeruser;
GRANT ALL PRIVILEGES ON TABLE course_tags TO offeruser;
GRANT ALL PRIVILEGES ON TABLE course_stats TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lessons TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lesson_content TO offeruser;
GRANT ALL PRIVILEGES ON TABLE questions TO offeruser;
GRANT ALL PRIVILEGES ON TABLE question_options TO offeruser;
GRANT ALL PRIVILEGES ON TABLE enrollments TO offeruser;
GRANT ALL PRIVILEGES ON TABLE lesson_progress TO offeruser;
GRANT ALL PRIVILEGES ON TABLE ratings TO offeruser;

-- Права по умолчанию на будущие объекты
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO offeruser;

