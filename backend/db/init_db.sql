--- START OF FILE init_db.txt ---

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

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 3. Создание таблиц
-- ===================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags ( -- Added tags table
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url VARCHAR(512) DEFAULT '/images/courses/default.png',
  estimated_duration INT DEFAULT 0,
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_tags (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE, -- Changed to tag_id
  PRIMARY KEY (course_id, tag_id)
);

CREATE TABLE IF NOT EXISTS course_stats (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  enrollments INT DEFAULT 0,
  avg_completion DECIMAL(5,2) DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0, -- Changed from avg_score to avg_rating, precision for ratings (e.g. 4.75)
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT, -- Added description
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_pages ( -- NEW: Replaces old lesson_content
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  page_type VARCHAR(50) NOT NULL, -- 'METHODICAL', 'ASSIGNMENT'
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS methodical_page_content ( -- NEW
  page_id UUID PRIMARY KEY REFERENCES lesson_pages(id) ON DELETE CASCADE,
  content TEXT, -- Markdown content
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES lesson_pages(id) ON DELETE CASCADE, -- Changed from lesson_id
  text TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT_INPUT', 'CODE_INPUT'
  correct_answer TEXT, -- NEW: For TEXT_INPUT and CODE_INPUT (can be a pattern or exact string)
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Add this if you want an updated_at trigger for questions
);

CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
  -- No created_at/updated_at here, usually managed with question's timestamp
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'inProgress', -- 'inProgress', 'completed'
  progress DECIMAL(5,2) NOT NULL DEFAULT 0, -- Overall course progress
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value >= 1 AND value <= 5),
  comment TEXT, -- Added comment field
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- For UPSERT behavior
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  score DECIMAL(5,2), -- Score for this lesson, e.g., from quizzes within it
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
);

-- NEW TABLE FOR USER ANSWERS
CREATE TABLE IF NOT EXISTS user_question_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  -- For SINGLE_CHOICE, this stores an array with the selected option's ID.
  -- For MULTIPLE_CHOICE, this stores an array of selected option IDs.
  -- For TEXT_INPUT/CODE_INPUT, this is NULL or empty array.
  selected_option_ids UUID[],
  answer_text TEXT,             -- For text/code input questions
  is_correct BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- A user has one answer record per question. Can be updated (e.g. for multiple attempts).
  UNIQUE (user_id, question_id)
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

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_courses_modtime BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_lessons_modtime BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_lesson_pages_modtime BEFORE UPDATE ON lesson_pages FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_methodical_page_content_modtime BEFORE UPDATE ON methodical_page_content FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_course_stats_modtime BEFORE UPDATE ON course_stats FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_ratings_modtime BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_questions_modtime BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_user_question_answers_modtime BEFORE UPDATE ON user_question_answers FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- ===================================================================
-- 5. Представление для полной информации о курсе (Обновлено для course_stats.avg_rating)
-- ===================================================================

CREATE OR REPLACE VIEW course_details AS
SELECT
  c.id,
  c.author_id,
  u.full_name AS author_name,
  c.title,
  c.description,
  c.cover_url,
  c.estimated_duration,
  c.version,
  c.is_published,
  cs.enrollments,
  cs.avg_completion,
  cs.avg_rating,
  c.created_at,
  c.updated_at
FROM courses c
JOIN users u ON c.author_id = u.id
LEFT JOIN course_stats cs ON c.id = cs.course_id;


-- ===================================================================
-- 6. Создание пользователя и выдача прав
-- ===================================================================

CREATE USER offeruser WITH ENCRYPTED PASSWORD 'offerpassword';
GRANT ALL PRIVILEGES ON DATABASE offer_hunt TO offeruser;
GRANT ALL ON SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO offeruser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO offeruser;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO offeruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO offeruser;
--- END OF FILE init_db.txt ---