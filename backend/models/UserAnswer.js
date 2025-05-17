// ==== File: backend/models/UserAnswer.js ====
const db = require('../config/db');

/**
 * Check if the provided answer is correct for the given question.
 * @param {Object} question - The question object from DB (must include type, correct_answer, and options if applicable).
 * @param {string[] | null} selectedOptionIds - Array of UUIDs of selected options (for choice questions).
 * @param {string | null} answerText - The text answer provided by the user (for text/code questions).
 * @returns {Promise<boolean>} True if correct, false otherwise.
 */
async function checkAnswerCorrectness(question, selectedOptionIds, answerText) {
  if (!question) throw new Error("Question data is required for checking answer.");

  switch (question.type) {
    case 'SINGLE_CHOICE':
      if (!selectedOptionIds || selectedOptionIds.length !== 1) return false;
      const correctSingleOption = await db.query( // Assuming db is the default pool client
        'SELECT id FROM question_options WHERE question_id = $1 AND is_correct = true',
        [question.id]
      );
      if (correctSingleOption.rows.length === 0) return false;
      return correctSingleOption.rows[0].id === selectedOptionIds[0];

    case 'MULTIPLE_CHOICE':
      const correctMultipleOptionsRes = await db.query( // Assuming db is the default pool client
        'SELECT id FROM question_options WHERE question_id = $1 AND is_correct = true ORDER BY id',
        [question.id]
      );
      const correctOptionIdsDb = correctMultipleOptionsRes.rows.map(opt => opt.id);
      
      if (!selectedOptionIds) selectedOptionIds = [];
      const sortedSelectedIds = [...selectedOptionIds].sort();

      if (correctOptionIdsDb.length !== sortedSelectedIds.length) return false;
      for (let i = 0; i < correctOptionIdsDb.length; i++) {
        if (correctOptionIdsDb[i] !== sortedSelectedIds[i]) return false;
      }
      return true;

    case 'TEXT_INPUT':
      if (answerText === null || answerText === undefined) return false;
      return answerText.trim() === (question.correct_answer || "").trim();

    case 'CODE_INPUT':
      if (answerText === null || answerText === undefined) return false;
      return answerText.trim() === (question.correct_answer || "").trim();
      
    default:
      return false;
  }
}

/**
 * Submit or update a user's answer for a question.
 * @param {string} userId
 * @param {string} questionId
 * @param {string[] | null} selectedOptionIds - For choice questions.
 * @param {string | null} answerText - For text/code questions.
 * @returns {Promise<Object>} The submitted/updated answer record.
 */
const submitAnswer = async (userId, questionId, selectedOptionIds, answerText) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const questionRes = await client.query(
      'SELECT q.id, q.page_id, q.type, q.correct_answer, lp.lesson_id, l.course_id '+
      'FROM questions q ' +
      'JOIN lesson_pages lp ON q.page_id = lp.id ' +
      'JOIN lessons l ON lp.lesson_id = l.id ' +
      'WHERE q.id = $1',
      [questionId]
    );
    if (questionRes.rows.length === 0) {
      throw new Error('Question not found or associated lesson/course missing.');
    }
    const question = questionRes.rows[0];
    const lessonIdForQuestion = question.lesson_id;
    const courseIdForQuestion = question.course_id;

    const enrollmentCheck = await client.query(
        'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseIdForQuestion]
    );
    if (enrollmentCheck.rows.length === 0) {
        throw new Error('User not enrolled in the course containing this question.');
    }

    const isCorrect = await checkAnswerCorrectness(question, selectedOptionIds, answerText); // Pass the full question object

    const result = await client.query(
      `INSERT INTO user_question_answers (user_id, question_id, selected_option_ids, answer_text, is_correct, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, question_id) DO UPDATE SET
         selected_option_ids = EXCLUDED.selected_option_ids,
         answer_text = EXCLUDED.answer_text,
         is_correct = EXCLUDED.is_correct,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, questionId, selectedOptionIds, answerText, isCorrect]
    );
    
    const assignmentPagesInLessonRes = await client.query(
        `SELECT id FROM lesson_pages WHERE lesson_id = $1 AND page_type = 'ASSIGNMENT'`,
        [lessonIdForQuestion]
    );
    const assignmentPageIds = assignmentPagesInLessonRes.rows.map(p => p.id);

    let totalQuestionsInLessonAssignments = 0;
    let correctlyAnsweredQuestionsInLesson = 0;

    if (assignmentPageIds.length > 0) {
        const questionsInLessonRes = await client.query(
            `SELECT id FROM questions WHERE page_id = ANY($1::UUID[])`,
            [assignmentPageIds]
        );
        const questionIdsInLesson = questionsInLessonRes.rows.map(q => q.id);
        totalQuestionsInLessonAssignments = questionIdsInLesson.length;

        if (totalQuestionsInLessonAssignments > 0) {
            const userAnswersForLessonQuestionsRes = await client.query(
                `SELECT COUNT(*) as count FROM user_question_answers 
                 WHERE user_id = $1 AND question_id = ANY($2::UUID[]) AND is_correct = true`,
                [userId, questionIdsInLesson]
            );
            correctlyAnsweredQuestionsInLesson = parseInt(userAnswersForLessonQuestionsRes.rows[0].count, 10);
        }
    }
    
    let lessonScore = 0;
    if (totalQuestionsInLessonAssignments > 0) {
        lessonScore = parseFloat(((correctlyAnsweredQuestionsInLesson / totalQuestionsInLessonAssignments) * 100).toFixed(2));
    }

    // Get current completed status to preserve it if it was already true
    const lessonProgressRes = await client.query(
      'SELECT completed FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lessonIdForQuestion]
    );
    const currentCompletedStatus = lessonProgressRes.rows.length > 0 ? lessonProgressRes.rows[0].completed : false;

    await client.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, score, last_activity, completed)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET
           score = EXCLUDED.score,
           last_activity = CURRENT_TIMESTAMP,
           completed = CASE WHEN lesson_progress.completed = TRUE THEN TRUE ELSE EXCLUDED.completed END -- Preserve if already true
         RETURNING completed`,
        [userId, lessonIdForQuestion, lessonScore, currentCompletedStatus] // Pass currentCompletedStatus
    );

    await client.query('COMMIT');
    const submittedAnswer = result.rows[0];
    return {
        ...submittedAnswer,
        lessonId: lessonIdForQuestion,
        lessonScore: lessonScore,
        courseId: courseIdForQuestion, // Include courseId for client-side context
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error submitting answer:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  submitAnswer,
  checkAnswerCorrectness,
};